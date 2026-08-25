import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DID = "did:plc:w64dlsa4zwjv2wljlvmymldc";
const HOST = "pds.example";

const resolvePdsForDid = vi.fn<(did: string) => Promise<string | undefined>>();

vi.mock("./identity", () => ({ resolvePdsForDid }));

const load = async () => {
	vi.resetModules();
	return await import("./teal-source");
};

const page = (count: number) =>
	new Response(
		JSON.stringify({
			records: Array.from({ length: count }, () => ({ uri: "at://x" })),
		}),
		{ status: 200, headers: { "content-type": "application/json" } },
	);

const collectionsQueried = (fetcher: ReturnType<typeof vi.fn>): Array<string> =>
	fetcher.mock.calls.map(
		(call) => new URL(call[0] as string).searchParams.get("collection") ?? "",
	);

describe("hasActivitySource", () => {
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

	it("reports a source when the status record exists, without reading the play feed", async () => {
		const fetcher = vi.fn().mockResolvedValue(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { hasActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(true);
		expect(collectionsQueried(fetcher)).toEqual(["fm.teal.actor.status"]);
	});

	it("reads the records without the user's session", async () => {
		const fetcher = vi.fn().mockResolvedValue(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { hasActivitySource } = await load();

		await hasActivitySource(DID);

		const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
		expect(url).toContain(`https://${HOST}/xrpc/com.atproto.repo.listRecords`);
		expect(new URL(url).searchParams.get("limit")).toBe("1");
		expect(init.headers).toBeUndefined();
	});

	it("falls back to the play feed when there is no status record", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(page(0))
			.mockResolvedValueOnce(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { hasActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(true);
		expect(collectionsQueried(fetcher)).toEqual([
			"fm.teal.actor.status",
			"fm.teal.feed.play",
		]);
	});

	it("reports no source when both collections are empty", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(0)));
		const { hasActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(false);
	});

	it("reports no source when the DID has no resolvable PDS", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		resolvePdsForDid.mockResolvedValue(undefined);
		const { hasActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(false);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("coalesces concurrent checks into one lookup", async () => {
		const fetcher = vi.fn().mockResolvedValue(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { hasActivitySource } = await load();

		const [first, second] = await Promise.all([
			hasActivitySource(DID),
			hasActivitySource(DID),
		]);

		expect([first, second]).toEqual([true, true]);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("serves a repeat check from the cache", async () => {
		const fetcher = vi.fn().mockResolvedValue(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { hasActivitySource } = await load();

		await hasActivitySource(DID);
		await hasActivitySource(DID);

		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("answers from storage without a request after a reload", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(1)));
		const initial = await load();
		await initial.hasActivitySource(DID);

		const second = vi.fn().mockResolvedValue(page(0));
		vi.stubGlobal("fetch", second);
		const reloaded = await load();

		expect(reloaded.peekActivitySource(DID)).toBe(true);
		expect(await reloaded.hasActivitySource(DID)).toBe(true);
		expect(second).not.toHaveBeenCalled();
	});

	it("reports no source and does not throw when the PDS refuses the read", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("nope", { status: 403 })),
		);
		const { hasActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(false);
	});

	it("reports no source and does not throw when the request fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		const { hasActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(false);
	});

	it("retries after a failure rather than caching it for the day", async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(page(1));
		vi.stubGlobal("fetch", fetcher);
		const { hasActivitySource, invalidateActivitySource } = await load();

		expect(await hasActivitySource(DID)).toBe(false);
		invalidateActivitySource(DID);
		expect(await hasActivitySource(DID)).toBe(true);
	});

	it("has nothing to peek before the first check", async () => {
		vi.stubGlobal("fetch", vi.fn());
		const { peekActivitySource } = await load();
		expect(peekActivitySource(DID)).toBeUndefined();
	});
});
