import { colibri } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import { createPreferencesGrant } from "../preferences/grant";
import { createPreferencesSpace } from "../preferences/remote";
import { createFakeSession, json, xrpcError } from "../remote/fake-session";
import { createRecords } from "../remote/records";
import { createTransport } from "../remote/transport";
import { createHostMode } from "./host-mode";

const VIEWER = "did:plc:viewer";
const APPVIEW = "did:web:appview.test";
const SPACE = "at://did:plc:space/space/social.colibri.beta.channel/general";
const MESSAGE = "social.colibri.beta.message";
const CREATE = "com.atproto.space.createRecord";
const DELEGATE = "com.atproto.space.getDelegationToken";
const CREATE_SPACE = "com.atproto.space.createSpace";

const status = (mode: string, pdsSupportsSpaces = false) =>
	json({ mode, pdsSupportsSpaces });

const created = json({
	rev: "3kaaaaaaaaaaa",
	results: [{ uri: `${SPACE}/${VIEWER}/${MESSAGE}/1`, cid: "bafy-record" }],
});

const setup = () => {
	const fake = createFakeSession(VIEWER);
	const transport = createTransport({
		session: fake.session,
		appViewDid: APPVIEW,
	});
	const host = createHostMode({ transport });
	const records = createRecords(transport, host);

	return { fake, transport, host, records };
};

const target = { space: SPACE, collection: MESSAGE, rkey: "1" };

describe("space record routing", () => {
	it("writes to the AppView while it hosts the account's data", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(colibri.polyfill.applyWrites.main.nsid, created);

		await records.createInSpace(target, { text: "hi" });

		const [call] = fake.callsTo(colibri.polyfill.applyWrites.main.nsid);

		expect(call?.headers.get("atproto-proxy")).toContain(APPVIEW);
		expect(call?.body).toEqual({
			space: SPACE,
			writes: [
				{
					$type: "social.colibri.beta.polyfill.applyWrites#create",
					collection: MESSAGE,
					rkey: "1",
					value: { $type: MESSAGE, text: "hi" },
				},
			],
		});
		expect(fake.callsTo(CREATE)).toHaveLength(0);
	});

	it("keeps writing to the AppView during a migration", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("migrating", true));
		fake.on(colibri.polyfill.applyWrites.main.nsid, created);

		await records.createInSpace(target, { text: "hi" });

		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
		expect(fake.callsTo(CREATE)).toHaveLength(0);
	});

	it("writes to the provider once the data lives there", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("native", true));
		fake.on(CREATE, json({ uri: "at://x", cid: "bafy" }));

		await records.createInSpace(target, { text: "hi" });

		const [call] = fake.callsTo(CREATE);

		expect(call?.headers.get("atproto-proxy")).toBeNull();
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			0,
		);
	});

	it("holds the first write until the status arrives", async () => {
		const { fake, records } = setup();
		let answer: (response: Response) => void = () => {};

		fake.on(
			colibri.polyfill.getStatus.main.nsid,
			() => new Promise<Response>((resolve) => (answer = resolve)),
		);
		fake.on(colibri.polyfill.applyWrites.main.nsid, created);

		const writing = records.createInSpace(target, { text: "hi" });

		await vi.waitFor(() =>
			expect(fake.callsTo(colibri.polyfill.getStatus.main.nsid)).toHaveLength(
				1,
			),
		);
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			0,
		);
		expect(fake.callsTo(CREATE)).toHaveLength(0);

		answer(await status("polyfill"));
		await writing;

		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
		expect(fake.callsTo(CREATE)).toHaveLength(0);
	});

	it("re-checks and retries once when the AppView no longer hosts the repo", async () => {
		const { fake, records } = setup();

		fake.on(
			colibri.polyfill.getStatus.main.nsid,
			status("polyfill"),
			status("native", true),
		);
		fake.on(
			colibri.polyfill.applyWrites.main.nsid,
			xrpcError(400, "RepoNotHosted"),
		);
		fake.on(CREATE, json({ uri: "at://x", cid: "bafy" }));

		await records.createInSpace(target, { text: "hi" });

		expect(fake.callsTo(colibri.polyfill.getStatus.main.nsid)).toHaveLength(2);
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
		expect(fake.callsTo(CREATE)).toHaveLength(1);
	});

	it("sends writes for a space that already moved to the provider mid-migration", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("migrating", true));
		fake.on(
			colibri.polyfill.applyWrites.main.nsid,
			xrpcError(400, "RepoNotHosted"),
		);
		fake.on(CREATE, json({ uri: "at://x", cid: "bafy" }));

		await records.createInSpace(target, { text: "hi" });
		await records.createInSpace(target, { text: "again" });

		expect(fake.callsTo(colibri.polyfill.getStatus.main.nsid)).toHaveLength(1);
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
		expect(fake.callsTo(CREATE)).toHaveLength(2);
	});

	it("routes a moved space back to the AppView after a fallback", async () => {
		const { fake, host, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("migrating", true));
		await host.refresh();
		host.markMoved(SPACE);
		host.apply({ mode: "polyfill", pdsSupportsSpaces: false });
		fake.on(colibri.polyfill.applyWrites.main.nsid, created);

		await records.createInSpace(target, { text: "hi" });

		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
		expect(fake.callsTo(CREATE)).toHaveLength(0);
	});

	it("re-checks and retries once when the provider lost spaces support", async () => {
		const { fake, records } = setup();

		fake.on(
			colibri.polyfill.getStatus.main.nsid,
			status("native", true),
			status("polyfill"),
		);
		fake.on(CREATE, xrpcError(501, "MethodNotImplemented"));
		fake.on(colibri.polyfill.applyWrites.main.nsid, created);

		await records.createInSpace(target, { text: "hi" });

		expect(fake.callsTo(CREATE)).toHaveLength(1);
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
	});

	it("re-checks and retries once when a stock provider has no space methods", async () => {
		const { fake, records } = setup();

		fake.on(
			colibri.polyfill.getStatus.main.nsid,
			status("native", true),
			status("polyfill"),
		);
		fake.on(
			CREATE,
			xrpcError(
				400,
				"InvalidRequest",
				"No service configured for com.atproto.space.createRecord",
			),
		);
		fake.on(colibri.polyfill.applyWrites.main.nsid, created);

		await records.createInSpace(target, { text: "hi" });

		expect(fake.callsTo(colibri.polyfill.getStatus.main.nsid)).toHaveLength(2);
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			1,
		);
	});

	it("retries only once", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(
			colibri.polyfill.applyWrites.main.nsid,
			xrpcError(400, "RepoNotHosted"),
		);

		await expect(
			records.createInSpace(target, { text: "hi" }),
		).rejects.toMatchObject({ context: { unknownCode: "RepoNotHosted" } });
		expect(fake.callsTo(colibri.polyfill.applyWrites.main.nsid)).toHaveLength(
			2,
		);
	});

	it("falls back to the provider when the status can't be read", async () => {
		const { fake, records } = setup();

		fake.on(
			colibri.polyfill.getStatus.main.nsid,
			xrpcError(500, "InternalServerError"),
		);
		fake.on(CREATE, json({ uri: "at://x", cid: "bafy" }));

		await records.createInSpace(target, { text: "hi" });

		expect(fake.callsTo(colibri.polyfill.getStatus.main.nsid)).toHaveLength(1);
		expect(fake.callsTo(CREATE)).toHaveLength(1);
	});

	it("creates a hosted record when an update finds none", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(
			colibri.polyfill.applyWrites.main.nsid,
			xrpcError(400, "RecordNotFound"),
			created,
		);

		await records.putInSpace(target, { text: "hi" });

		const kinds = fake
			.callsTo(colibri.polyfill.applyWrites.main.nsid)
			.map((call) => (call.body as { writes: { $type: string }[] }).writes[0]);

		expect(kinds.map((write) => write?.$type)).toEqual([
			"social.colibri.beta.polyfill.applyWrites#update",
			"social.colibri.beta.polyfill.applyWrites#create",
		]);
	});

	it("reads and lists hosted records through the AppView", async () => {
		const { fake, records } = setup();
		const uri = `${SPACE}/${VIEWER}/${MESSAGE}/1`;

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(
			colibri.polyfill.getRecord.main.nsid,
			json({ uri, cid: "bafy", value: { a: 1 } }),
		);
		fake.on(
			colibri.polyfill.listRecords.main.nsid,
			json({ records: [{ uri, cid: "bafy", value: { a: 1 } }] }),
		);

		await expect(records.getInSpace(target)).resolves.toMatchObject({
			value: { a: 1 },
		});
		await expect(
			records.listInSpace({ space: SPACE, collection: MESSAGE }),
		).resolves.toEqual([
			{ collection: MESSAGE, rkey: "1", cid: "bafy", value: { a: 1 } },
		]);
		expect(fake.callsTo("com.atproto.space.getRecord")).toHaveLength(0);
		expect(fake.callsTo("com.atproto.space.listRecords")).toHaveLength(0);
	});

	it("ignores a hosted delete of a record that is already gone", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(
			colibri.polyfill.applyWrites.main.nsid,
			xrpcError(400, "RecordNotFound"),
		);

		await expect(records.deleteInSpace(target)).resolves.toBeUndefined();
	});

	it("uploads space attachments to the AppView while it hosts the data", async () => {
		const { fake, records } = setup();
		const blob = {
			$type: "blob",
			ref: { $link: "bafy-blob" },
			mimeType: "image/png",
			size: 3,
		};

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(colibri.polyfill.uploadBlob.main.nsid, json({ blob }));

		const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

		await expect(records.uploadSpaceBlob(file)).resolves.toEqual(blob);
		expect(fake.callsTo("com.atproto.repo.uploadBlob")).toHaveLength(0);
		expect(
			fake
				.callsTo(colibri.polyfill.uploadBlob.main.nsid)[0]
				?.headers.get("content-type"),
		).toBe("image/png");
	});

	it("keeps public uploads on the provider", async () => {
		const { fake, records } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(
			"com.atproto.repo.uploadBlob",
			json({ blob: { $type: "blob", ref: { $link: "x" } } }),
		);

		await records.uploadBlob(new Blob(["a"]));

		expect(fake.callsTo("com.atproto.repo.uploadBlob")).toHaveLength(1);
		expect(fake.callsTo(colibri.polyfill.uploadBlob.main.nsid)).toHaveLength(0);
	});
});

describe("preferences space while hosted", () => {
	it("doesn't create the space on the provider", async () => {
		const { fake, transport, host } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));

		await createPreferencesSpace(transport, host).ensure();

		expect(fake.callsTo(CREATE_SPACE)).toHaveLength(0);
	});

	it("creates the space on the provider once native", async () => {
		const { fake, transport, host } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("native", true));
		fake.on(CREATE_SPACE, json({}));

		await createPreferencesSpace(transport, host).ensure();

		expect(fake.callsTo(CREATE_SPACE)).toHaveLength(1);
	});

	it("starts the grant loop only once the data lives on the provider", async () => {
		const { fake, transport, host } = setup();

		fake.on(colibri.polyfill.getStatus.main.nsid, status("polyfill"));
		fake.on(DELEGATE, json({ token: "delegation" }));
		fake.on(
			"social.colibri.beta.actor.grantSpaceAccess",
			json({ expiresAt: new Date(Date.now() + 600_000).toISOString() }),
		);

		const space = createPreferencesSpace(transport, host);
		const stop = createPreferencesGrant({ transport, space, host }).start();

		await host.resolved();
		await Promise.resolve();

		expect(fake.callsTo(DELEGATE)).toHaveLength(0);

		host.apply({ mode: "native", pdsSupportsSpaces: true });

		await vi.waitFor(() => expect(fake.callsTo(DELEGATE)).toHaveLength(1));

		stop();
	});
});
