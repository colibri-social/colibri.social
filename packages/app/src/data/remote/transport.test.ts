import { ColibriError, colibri } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import { createFakeSession, json, xrpcError } from "./fake-session";
import { createTransport, encodeParams } from "./transport";

const APPVIEW = "did:web:spaces-api.colibri.social";

const setup = () => {
	const fake = createFakeSession();
	const transport = createTransport({
		session: fake.session,
		appViewDid: APPVIEW,
	});
	return { fake, transport };
};

describe("encodeParams", () => {
	it("skips undefined values and repeats arrays", () => {
		expect(encodeParams({ a: "x", b: undefined, c: ["1", "2"], d: 3 })).toBe(
			"?a=x&c=1&c=2&d=3",
		);
		expect(encodeParams({})).toBe("");
	});
});

describe("createTransport", () => {
	it("sends queries through the AppView proxy with encoded params", async () => {
		const { fake, transport } = setup();
		fake.on(colibri.community.listChannels.main.nsid, json({ channels: [] }));

		await transport.query(colibri.community.listChannels.main, {
			params: { community: "did:plc:space" },
		});

		const [call] = fake.callsTo(colibri.community.listChannels.main.nsid);
		expect(call?.method).toBe("GET");
		expect(call?.params.get("community")).toBe("did:plc:space");
		expect(call?.headers.get("atproto-proxy")).toBe(
			`${APPVIEW}#colibri_appview`,
		);
	});

	it("posts procedure payloads as a JSON body", async () => {
		const { fake, transport } = setup();
		fake.on(colibri.community.kick.main.nsid, json({}));

		await transport.procedure(colibri.community.kick.main, {
			body: { community: "did:plc:space", subject: "did:plc:other" },
		});

		const [call] = fake.callsTo(colibri.community.kick.main.nsid);
		expect(call?.method).toBe("POST");
		expect(call?.headers.get("content-type")).toBe("application/json");
		expect(call?.body).toEqual({
			community: "did:plc:space",
			subject: "did:plc:other",
		});
	});

	it("sends push procedures through the notification service proxy", async () => {
		const { fake, transport } = setup();
		fake.on(colibri.notification.registerPush.main.nsid, json({}));

		await transport.notifProcedure(colibri.notification.registerPush.main, {
			body: { provider: "fcm", platform: "android", token: "t" },
		});

		const [call] = fake.callsTo(colibri.notification.registerPush.main.nsid);
		expect(call?.method).toBe("POST");
		expect(call?.headers.get("atproto-proxy")).toBe(
			`${APPVIEW}#colibri_notifs`,
		);
	});

	it("leaves the proxy header off PDS calls", async () => {
		const { fake, transport } = setup();
		fake.on("com.atproto.space.getRecord", json({ uri: "at://x", value: {} }));

		await transport.pdsQuery("com.atproto.space.getRecord", {
			params: { space: "at://x/space/y/z" },
		});

		const [call] = fake.callsTo("com.atproto.space.getRecord");
		expect(call?.headers.has("atproto-proxy")).toBe(false);
	});

	it("retries a query after a transient failure", async () => {
		const { fake, transport } = setup();
		fake.on(
			colibri.actor.listCommunities.main.nsid,
			xrpcError(502, "UpstreamFailure"),
			json({ communities: [] }),
		);

		const result = await transport.query(colibri.actor.listCommunities.main);

		expect(result.communities).toEqual([]);
		expect(fake.callsTo(colibri.actor.listCommunities.main.nsid)).toHaveLength(
			2,
		);
	});

	it("sends a procedure once and throws a classified error", async () => {
		const { fake, transport } = setup();
		fake.on(colibri.community.ban.main.nsid, xrpcError(502, "UpstreamFailure"));

		const failure = await transport
			.procedure(colibri.community.ban.main, {
				body: { community: "did:plc:space", subject: "did:plc:other" },
			})
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ColibriError);
		expect((failure as ColibriError).code).toBe("UpstreamFailure");
		expect(fake.callsTo(colibri.community.ban.main.nsid)).toHaveLength(1);
	});

	it("does not retry a permission error", async () => {
		const { fake, transport } = setup();
		fake.on(
			colibri.community.listBans.main.nsid,
			xrpcError(403, "Forbidden", "not allowed"),
		);

		const failure = await transport
			.query(colibri.community.listBans.main, {
				params: { community: "did:plc:space" },
			})
			.then(
				() => undefined,
				(error: unknown) => error as ColibriError,
			);

		expect(failure?.code).toBe("Forbidden");
		expect(failure?.serverMessage).toBe("not allowed");
		expect(fake.callsTo(colibri.community.listBans.main.nsid)).toHaveLength(1);
	});

	it("reports a missing permission with the method that hit it", async () => {
		const fake = createFakeSession();
		const onScopesRejected = vi.fn<(method: string) => void>();
		const transport = createTransport({
			session: fake.session,
			appViewDid: APPVIEW,
			onScopesRejected,
		});
		const method = colibri.emoji.getCatalog.main;
		fake.on(method.nsid, xrpcError(403, "ScopeMissingError", "missing"));

		const failure = await transport
			.query(method, { params: { community: "did:plc:space" } })
			.then(
				() => undefined,
				(error: unknown) => error as ColibriError,
			);

		expect(failure?.code).toBe("ScopesMissing");
		expect(onScopesRejected).toHaveBeenCalledExactlyOnceWith(method.nsid);
	});

	it("reports nothing for other failures", async () => {
		const fake = createFakeSession();
		const onScopesRejected = vi.fn<(method: string) => void>();
		const transport = createTransport({
			session: fake.session,
			appViewDid: APPVIEW,
			onScopesRejected,
		});
		fake.on(
			colibri.community.listBans.main.nsid,
			xrpcError(403, "Forbidden", "not allowed"),
		);

		await transport
			.query(colibri.community.listBans.main, {
				params: { community: "did:plc:space" },
			})
			.catch(() => undefined);

		expect(onScopesRejected).not.toHaveBeenCalled();
	});

	it("sends raw bodies with their encoding", async () => {
		const { fake, transport } = setup();
		fake.on(colibri.community.putImage.main.nsid, json({ community: {} }));
		const file = new Blob(["png"], { type: "image/png" });

		await transport.procedure(colibri.community.putImage.main, {
			params: { community: "did:plc:space", kind: "picture" },
			raw: { data: file, encoding: "image/png" },
		});

		const [call] = fake.callsTo(colibri.community.putImage.main.nsid);
		expect(call?.headers.get("content-type")).toBe("image/png");
		expect(call?.params.get("kind")).toBe("picture");
		expect(call?.body).toBe(file);
	});
});
