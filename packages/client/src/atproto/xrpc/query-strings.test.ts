import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRecords } from "./com/atproto/repo/listRecords";
import { getChannelView } from "./social/colibri/channel/getChannelView";
import { listMessages } from "./social/colibri/channel/listMessages";
import { getData } from "./social/colibri/community/getData";
import { registerCredentials } from "./social/colibri/community/registerCredentials";
import { trendingGifs } from "./social/colibri/embed/trendingGifs";
import { listNotifications } from "./social/colibri/notification/listNotifications";
import { registerPush } from "./social/colibri/notification/registerPush";
import { updateSeen } from "./social/colibri/notification/updateSeen";

const CHANNEL = "at://did:plc:owner/social.colibri.channel/chan-a";
const REPO = "did:plc:owner";
const COLLECTION = "social.colibri.message";

const ok = (body: unknown = {}) =>
	vi.fn().mockResolvedValue(
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	);

const urlOf = (fetch: ReturnType<typeof ok>) =>
	fetch.mock.calls[0][0] as string;

const initOf = (fetch: ReturnType<typeof ok>) =>
	fetch.mock.calls[0][1] as RequestInit | undefined;

const queryOf = (fetch: ReturnType<typeof ok>) =>
	new URL(urlOf(fetch), "http://x").searchParams;

describe("no wrapper serialises an omitted optional param", () => {
	it("listRecords omits limit, cursor and reverse", async () => {
		const fetch = ok();
		await listRecords(fetch, REPO, COLLECTION, undefined, undefined, undefined);

		expect(urlOf(fetch)).not.toContain("undefined");
		const query = queryOf(fetch);
		expect(query.has("limit")).toBe(false);
		expect(query.has("cursor")).toBe(false);
		expect(query.has("reverse")).toBe(false);
	});

	it("listMessages omits limit, cursor and all", async () => {
		const fetch = ok();
		await listMessages(fetch, CHANNEL, undefined, undefined, undefined);

		expect(urlOf(fetch)).not.toContain("undefined");
		const query = queryOf(fetch);
		expect(query.has("limit")).toBe(false);
		expect(query.has("cursor")).toBe(false);
		expect(query.has("all")).toBe(false);
	});

	it("listNotifications omits limit and cursor", async () => {
		const fetch = ok();
		await listNotifications(fetch, undefined, undefined);

		expect(urlOf(fetch)).not.toContain("undefined");
		expect(urlOf(fetch)).toBe(
			"/xrpc/social.colibri.notification.listNotifications",
		);
	});

	it("updateSeen omits seenAt entirely rather than sending a marker", async () => {
		const fetch = ok();
		await updateSeen(fetch, undefined);

		expect(urlOf(fetch)).toBe("/xrpc/social.colibri.notification.updateSeen");
	});

	it("trendingGifs omits page", async () => {
		const fetch = ok();
		await trendingGifs(fetch, undefined);

		expect(urlOf(fetch)).toBe("/xrpc/social.colibri.embed.trendingGifs");
	});
});

describe("listRecords", () => {
	it("always sends repo and collection", async () => {
		const fetch = ok();
		await listRecords(fetch, REPO, COLLECTION, undefined, undefined, undefined);

		const query = queryOf(fetch);
		expect(query.get("repo")).toBe(REPO);
		expect(query.get("collection")).toBe(COLLECTION);
	});

	it("sends every optional param when supplied", async () => {
		const fetch = ok();
		await listRecords(fetch, REPO, COLLECTION, 25, "cur-1", true);

		const query = queryOf(fetch);
		expect(query.get("limit")).toBe("25");
		expect(query.get("cursor")).toBe("cur-1");
		expect(query.get("reverse")).toBe("true");
	});

	it("sends a false boolean rather than dropping it", async () => {
		const fetch = ok();
		await listRecords(fetch, REPO, COLLECTION, undefined, undefined, false);

		expect(queryOf(fetch).get("reverse")).toBe("false");
	});

	it("sends a zero limit rather than dropping it", async () => {
		const fetch = ok();
		await listRecords(fetch, REPO, COLLECTION, 0, undefined, undefined);

		expect(queryOf(fetch).get("limit")).toBe("0");
	});
});

describe("listMessages", () => {
	it("round-trips an at-uri channel through encoding", async () => {
		const fetch = ok({ messages: [] });
		await listMessages(fetch, CHANNEL, undefined, undefined, undefined);

		expect(queryOf(fetch).get("channel")).toBe(CHANNEL);
	});

	it("sends every optional param when supplied", async () => {
		const fetch = ok({ messages: [] });
		await listMessages(fetch, CHANNEL, 50, "3lk2abc", true);

		const query = queryOf(fetch);
		expect(query.get("limit")).toBe("50");
		expect(query.get("cursor")).toBe("3lk2abc");
		expect(query.get("all")).toBe("true");
	});

	it("sends all=false rather than dropping it", async () => {
		const fetch = ok({ messages: [] });
		await listMessages(fetch, CHANNEL, undefined, undefined, false);

		expect(queryOf(fetch).get("all")).toBe("false");
	});

	it("escapes a cursor containing a query delimiter", async () => {
		const fetch = ok({ messages: [] });
		await listMessages(fetch, CHANNEL, undefined, "a&all=true", undefined);

		expect(queryOf(fetch).get("cursor")).toBe("a&all=true");
		expect(queryOf(fetch).has("all")).toBe(false);
	});

	it("returns the parsed body", async () => {
		const fetch = ok({ messages: [{ uri: "at://x/y/z" }] });
		const result = await listMessages(
			fetch,
			CHANNEL,
			undefined,
			undefined,
			undefined,
		);

		expect(result.ok && result.data?.messages).toHaveLength(1);
	});

	it("reports a transport failure rather than rejecting", async () => {
		const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
		const result = await listMessages(
			fetch,
			CHANNEL,
			undefined,
			undefined,
			undefined,
		);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("NetworkFailed");
		expect(result.error.method).toBe("social.colibri.channel.listMessages");
	});
});

describe("listNotifications", () => {
	it("sends only the params it was given", async () => {
		const fetch = ok({ notifications: [] });
		await listNotifications(fetch, 10, undefined);

		const query = queryOf(fetch);
		expect(query.get("limit")).toBe("10");
		expect(query.has("cursor")).toBe(false);
	});

	it("sends a cursor without a limit", async () => {
		const fetch = ok({ notifications: [] });
		await listNotifications(fetch, undefined, "cur-1");

		const query = queryOf(fetch);
		expect(query.has("limit")).toBe(false);
		expect(query.get("cursor")).toBe("cur-1");
	});
});

describe("updateSeen", () => {
	it("posts", async () => {
		const fetch = ok({ updated: 1 });
		await updateSeen(fetch, undefined);

		expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
	});

	it("sends seenAt when supplied", async () => {
		const fetch = ok({ updated: 1 });
		await updateSeen(fetch, "2026-07-26T12:00:00.000Z");

		expect(queryOf(fetch).get("seenAt")).toBe("2026-07-26T12:00:00.000Z");
	});
});

describe("registerPush", () => {
	const webPush = {
		platform: "web",
		endpoint: "https://push.example/abc",
		keys: { p256dh: "key", auth: "secret" },
	} as const;

	const fcmPush = { platform: "android", token: "fcm-token" } as const;

	const bodyOf = (fetch: ReturnType<typeof ok>) =>
		JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string);

	it("posts json", async () => {
		const fetch = ok({ registered: true });
		await registerPush(fetch, webPush);

		expect(fetch.mock.calls[0][1]).toMatchObject({
			method: "POST",
			headers: { "content-type": "application/json" },
		});
	});

	it("discriminates a web push subscription by its keys", async () => {
		const fetch = ok({ registered: true });
		await registerPush(fetch, webPush);

		expect(bodyOf(fetch)).toEqual({
			platform: "web",
			subscription: {
				$type: "social.colibri.notification.registerPush#webPushSubscription",
				endpoint: webPush.endpoint,
				keys: webPush.keys,
			},
		});
	});

	it("discriminates an fcm subscription by its token", async () => {
		const fetch = ok({ registered: true });
		await registerPush(fetch, fcmPush);

		expect(bodyOf(fetch)).toEqual({
			platform: "android",
			subscription: {
				$type: "social.colibri.notification.registerPush#fcmSubscription",
				token: "fcm-token",
			},
		});
	});

	it("never leaks web push keys into an fcm body", async () => {
		const fetch = ok({ registered: true });
		await registerPush(fetch, fcmPush);

		expect(bodyOf(fetch).subscription).not.toHaveProperty("keys");
		expect(bodyOf(fetch).subscription).not.toHaveProperty("endpoint");
	});

	it("surfaces the declared code from a non-2xx json body", async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: "InvalidRequest" }), {
				status: 400,
			}),
		);

		const result = await registerPush(fetch, webPush);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("InvalidRequest");
		expect(result.error.retryable).toBe(false);
	});
});

describe("registerCredentials", () => {
	const DID = "did:plc:community";
	const PDS = "https://pds.example";

	it("round-trips a password containing query delimiters", async () => {
		const fetch = ok({ did: DID, source: "byo" });
		await registerCredentials(fetch, DID, PDS, "owner.example", "a&b=c#d e+f");

		expect(queryOf(fetch).get("password")).toBe("a&b=c#d e+f");
	});

	it("does not let a password inject extra query params", async () => {
		const fetch = ok({ did: DID, source: "byo" });
		await registerCredentials(fetch, DID, PDS, "owner.example", "x&did=evil");

		expect(queryOf(fetch).get("did")).toBe(DID);
		expect(queryOf(fetch).getAll("did")).toHaveLength(1);
	});

	it("round-trips a pds url with its scheme intact", async () => {
		const fetch = ok({ did: DID, source: "byo" });
		await registerCredentials(fetch, DID, PDS, "owner.example", "pw");

		expect(queryOf(fetch).get("pds")).toBe(PDS);
	});
});

describe("error handling", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("resolves to a failure rather than rejecting", async () => {
		const boom = vi.fn().mockRejectedValue(new Error("offline"));

		for (const result of [
			await listRecords(
				boom,
				REPO,
				COLLECTION,
				undefined,
				undefined,
				undefined,
			),
			await listNotifications(boom, undefined, undefined),
			await updateSeen(boom, undefined),
			await trendingGifs(boom, 1),
		]) {
			expect(result.ok).toBe(false);
		}
	});

	it("classifies a 502 as a retryable upstream failure", async () => {
		const fetch = vi.fn().mockResolvedValue(new Response("", { status: 502 }));
		const result = await trendingGifs(fetch, 1);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("UpstreamFailure");
		expect(result.error.retryable).toBe(true);
	});
});

describe("the channel and community reads forward an abort signal", () => {
	const COMMUNITY = "at://did:plc:owner/social.colibri.community/self";

	it("listMessages passes the signal through as request init", async () => {
		const fetch = ok({ messages: [] });
		const signal = new AbortController().signal;
		await listMessages(fetch, CHANNEL, undefined, undefined, undefined, signal);

		expect(initOf(fetch)?.signal).toBe(signal);
	});

	it("getChannelView passes the signal through as request init", async () => {
		const fetch = ok({ messages: [], unseen: [] });
		const signal = new AbortController().signal;
		await getChannelView(fetch, CHANNEL, undefined, signal);

		expect(initOf(fetch)?.signal).toBe(signal);
	});

	it("getData passes the signal through as request init", async () => {
		const fetch = ok({});
		const signal = new AbortController().signal;
		await getData(fetch, COMMUNITY, signal);

		expect(initOf(fetch)?.signal).toBe(signal);
	});

	it("sends no init at all when no signal is given", async () => {
		const fetch = ok({ messages: [] });
		await listMessages(fetch, CHANNEL, undefined, undefined, undefined);

		expect(initOf(fetch)).toBeUndefined();
	});
});
