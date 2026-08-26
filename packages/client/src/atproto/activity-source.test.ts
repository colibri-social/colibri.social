import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DID = "did:plc:w64dlsa4zwjv2wljlvmymldc";
const HOST = "pds.example";

const TEAL_STATUS = "fm.teal.actor.status";
const TEAL_ALPHA_STATUS = "fm.teal.alpha.actor.status";
const TEAL_PLAY = "fm.teal.feed.play";
const ROCKSKY_STATUS = "app.rocksky.actor.status";
const ATRADIO_STATUS = "fm.atradio.actor.status";

const resolvePdsForDid = vi.fn<(did: string) => Promise<string | undefined>>();

vi.mock("./identity", () => ({ resolvePdsForDid }));

const load = async () => {
	vi.resetModules();
	return await import("./activity-source");
};

const page = (count: number) =>
	new Response(
		JSON.stringify({
			records: Array.from({ length: count }, () => ({ uri: "at://x" })),
		}),
		{ status: 200, headers: { "content-type": "application/json" } },
	);

const collectionOf = (url: string) =>
	new URL(url).searchParams.get("collection") ?? "";

const holding = (...present: string[]) =>
	vi.fn(async (url: string, _init?: RequestInit) =>
		page(present.includes(collectionOf(url)) ? 1 : 0),
	);

const collectionsQueried = (fetcher: ReturnType<typeof vi.fn>): Array<string> =>
	fetcher.mock.calls.map((call) => collectionOf(call[0] as string));

describe("detectActivitySource", () => {
	let store: Record<string, string>;

	beforeEach(() => {
		store = {};
		resolvePdsForDid.mockReset();
		resolvePdsForDid.mockResolvedValue(HOST);
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, value: string) => {
				store[key] = value;
			},
			removeItem: (key: string) => {
				delete store[key];
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("names teal.fm from the status record alone, reading nothing else", async () => {
		const fetcher = holding(TEAL_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("teal.fm");
		expect(collectionsQueried(fetcher)).toEqual([TEAL_STATUS]);
	});

	it("reads the records without the user's session", async () => {
		const fetcher = holding(TEAL_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		await detectActivitySource(DID);

		const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
		expect(url).toContain(`https://${HOST}/xrpc/com.atproto.repo.listRecords`);
		expect(new URL(url).searchParams.get("limit")).toBe("1");
		expect(init.headers).toBeUndefined();
	});

	it("names teal.fm from the alpha collection a lot of accounts write", async () => {
		const fetcher = holding(TEAL_ALPHA_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("teal.fm");
		expect(collectionsQueried(fetcher)).toEqual([
			TEAL_STATUS,
			TEAL_ALPHA_STATUS,
		]);
	});

	it("falls back to the play feed when there is no status record", async () => {
		const fetcher = holding(TEAL_PLAY);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("teal.fm");
		expect(collectionsQueried(fetcher)).toEqual([
			TEAL_STATUS,
			TEAL_ALPHA_STATUS,
			TEAL_PLAY,
		]);
	});

	it("names rocksky.app when teal.fm has nothing", async () => {
		const fetcher = holding(ROCKSKY_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("rocksky.app");
	});

	it("names rocksky.app from a scrobble when nothing is playing", async () => {
		vi.stubGlobal("fetch", holding("app.rocksky.scrobble"));
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("rocksky.app");
	});

	it("names atradio.fm when neither of the others has anything", async () => {
		const fetcher = holding(ATRADIO_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("atradio.fm");
		expect(collectionsQueried(fetcher)).toContain(ROCKSKY_STATUS);
	});

	it("names the first service it finds when several are connected", async () => {
		vi.stubGlobal("fetch", holding(ROCKSKY_STATUS, ATRADIO_STATUS));
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBe("rocksky.app");
	});

	it("names nothing when every collection is empty", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(0)));
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBeNull();
	});

	it("does not remember an absence, so connecting a service is noticed", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(0)));
		const initial = await load();
		expect(await initial.detectActivitySource(DID)).toBeNull();
		expect(Object.keys(store)).toEqual([]);

		vi.stubGlobal("fetch", holding(ATRADIO_STATUS));
		const reloaded = await load();

		expect(reloaded.peekActivitySource(DID)).toBeUndefined();
		expect(await reloaded.detectActivitySource(DID)).toBe("atradio.fm");
	});

	it("names nothing when the DID has no resolvable PDS", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		resolvePdsForDid.mockResolvedValue(undefined);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("coalesces concurrent checks into one lookup", async () => {
		const fetcher = holding(TEAL_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		const [first, second] = await Promise.all([
			detectActivitySource(DID),
			detectActivitySource(DID),
		]);

		expect([first, second]).toEqual(["teal.fm", "teal.fm"]);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("serves a repeat check from the cache", async () => {
		const fetcher = holding(TEAL_STATUS);
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource } = await load();

		await detectActivitySource(DID);
		await detectActivitySource(DID);

		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("answers from storage without a request after a reload", async () => {
		vi.stubGlobal("fetch", holding(ROCKSKY_STATUS));
		const initial = await load();
		await initial.detectActivitySource(DID);

		const second = vi.fn().mockResolvedValue(page(0));
		vi.stubGlobal("fetch", second);
		const reloaded = await load();

		expect(reloaded.peekActivitySource(DID)).toBe("rocksky.app");
		expect(await reloaded.detectActivitySource(DID)).toBe("rocksky.app");
		expect(second).not.toHaveBeenCalled();
	});

	it("ignores a stored entry naming a service it no longer knows", async () => {
		store[`colibri:activity-source:v3:${DID}`] = JSON.stringify({
			provider: "lastfm.example",
			expiresAt: Date.now() + 60_000,
		});
		vi.stubGlobal("fetch", holding(TEAL_STATUS));
		const { peekActivitySource, detectActivitySource } = await load();

		expect(peekActivitySource(DID)).toBeUndefined();
		expect(await detectActivitySource(DID)).toBe("teal.fm");
	});

	it("names nothing and does not throw when the PDS refuses the read", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("nope", { status: 403 })),
		);
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBeNull();
	});

	it("names nothing and does not throw when the request fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		const { detectActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBeNull();
	});

	it("retries after a failure rather than caching it for the day", async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { detectActivitySource, invalidateActivitySource } = await load();

		expect(await detectActivitySource(DID)).toBeNull();
		invalidateActivitySource(DID);
		expect(await detectActivitySource(DID)).toBe("teal.fm");
	});

	it("has nothing to peek before the first check", async () => {
		vi.stubGlobal("fetch", vi.fn());
		const { peekActivitySource } = await load();
		expect(peekActivitySource(DID)).toBeUndefined();
	});
});
