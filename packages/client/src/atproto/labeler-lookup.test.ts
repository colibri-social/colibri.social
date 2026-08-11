import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LABELER_DID, DEFAULT_LABELER_URL } from "../utils/labeler";

const A = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb";
const C = "did:plc:cccccccccccccccccccccccc";
const D = "did:plc:dddddddddddddddddddddddd";

const FLUSH = 60;
const FRAME = 16;
const MAX_FLUSH_DELAY_MS = 150;
const QUERY_LIMIT = 250;
const FAILURE_TTL_MS = 30_000;

interface Row {
	uri: string;
	val: string;
	neg?: boolean;
	exp?: string;
	cts: string;
}

const row = (uri: string, val: string, cts: string, neg?: boolean): Row => ({
	uri,
	val,
	cts,
	...(neg === undefined ? {} : { neg }),
});

const page = (labels: Array<Row>, cursor?: string) => ({
	ok: true,
	status: 200,
	headers: { get: () => null },
	json: () => Promise.resolve({ labels, cursor }),
	text: () => Promise.resolve(""),
});

const fill = (count: number, uri: string): Array<Row> =>
	Array.from({ length: count }, (_, i) =>
		row(uri, `filler-${i}`, "2026-01-01T00:00:00.000Z"),
	);

let fetchMock: ReturnType<typeof vi.fn>;

const load = async () => {
	vi.resetModules();
	return await import("./labeler-lookup");
};

const urlOf = (call: number): URL =>
	new URL(fetchMock.mock.calls[call]?.[0] as string);

beforeEach(() => {
	vi.useFakeTimers();
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("getLabelerBadges", () => {
	it("coalesces every DID requested in one window into a single query", async () => {
		fetchMock.mockResolvedValue(page([]));
		const { getLabelerBadges } = await load();

		const pending = Promise.all([
			getLabelerBadges(A),
			getLabelerBadges(B),
			getLabelerBadges(C),
		]);
		await vi.advanceTimersByTimeAsync(FLUSH);
		await pending;

		expect(fetchMock).toHaveBeenCalledTimes(1);

		const url = urlOf(0);
		expect(url.origin).toBe(DEFAULT_LABELER_URL);
		expect(url.pathname).toBe("/xrpc/com.atproto.label.queryLabels");
		expect(url.searchParams.getAll("uriPatterns")).toEqual([A, B, C]);
		expect(url.searchParams.get("sources")).toBe(DEFAULT_LABELER_DID);
		expect(url.searchParams.get("limit")).toBe(String(QUERY_LIMIT));
	});

	it("coalesces DIDs that arrive on separate frames into a single query", async () => {
		fetchMock.mockResolvedValue(page([]));
		const { getLabelerBadges } = await load();

		const first = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FRAME);
		const second = getLabelerBadges(B);
		await vi.advanceTimersByTimeAsync(FRAME);
		const third = getLabelerBadges(C);
		await vi.advanceTimersByTimeAsync(FLUSH);
		await Promise.all([first, second, third]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(urlOf(0).searchParams.getAll("uriPatterns")).toEqual([A, B, C]);
	});

	it("stops deferring once the maximum delay is reached", async () => {
		fetchMock.mockResolvedValue(page([]));
		const { getLabelerBadges } = await load();

		const pending = [getLabelerBadges(A)];
		for (const did of [B, C, D]) {
			await vi.advanceTimersByTimeAsync(40);
			expect(fetchMock).not.toHaveBeenCalled();
			pending.push(getLabelerBadges(did));
		}

		await vi.advanceTimersByTimeAsync(MAX_FLUSH_DELAY_MS);
		await Promise.all(pending);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(urlOf(0).searchParams.getAll("uriPatterns")).toEqual([A, B, C, D]);
	});

	it("groups a flat response by uri so badges never leak between DIDs", async () => {
		fetchMock.mockResolvedValue(
			page([
				row(A, "team", "2026-01-01T00:00:00.000Z"),
				row(B, "donator", "2026-01-01T00:00:00.000Z"),
			]),
		);
		const { getLabelerBadges } = await load();

		const pending = Promise.all([getLabelerBadges(A), getLabelerBadges(B)]);
		await vi.advanceTimersByTimeAsync(FLUSH);
		const [a, b] = await pending;

		expect(a.map((l) => l.val)).toEqual(["team"]);
		expect(b.map((l) => l.val)).toEqual(["donator"]);
	});

	it("settles a DID with no rows in the response to an empty list", async () => {
		fetchMock.mockResolvedValue(
			page([row(A, "team", "2026-01-01T00:00:00.000Z")]),
		);
		const { getLabelerBadges } = await load();

		const pending = Promise.all([getLabelerBadges(A), getLabelerBadges(C)]);
		await vi.advanceTimersByTimeAsync(FLUSH);
		const [, c] = await pending;

		expect(c).toEqual([]);
	});

	it("chunks past the per-query DID cap", async () => {
		fetchMock.mockResolvedValue(page([]));
		const { getLabelerBadges } = await load();

		const dids = Array.from(
			{ length: 60 },
			(_, i) => `did:plc:${String(i).padStart(24, "0")}`,
		);
		const pending = Promise.all(dids.map((did) => getLabelerBadges(did)));
		await vi.advanceTimersByTimeAsync(FLUSH);
		await pending;

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(urlOf(0).searchParams.getAll("uriPatterns")).toHaveLength(50);
		expect(urlOf(1).searchParams.getAll("uriPatterns")).toHaveLength(10);
	});

	it("drains the cursor while pages come back full, then stops on a short page", async () => {
		fetchMock
			.mockResolvedValueOnce(page(fill(QUERY_LIMIT, A), "250"))
			.mockResolvedValueOnce(
				page([row(A, "team", "2026-01-01T00:00:00.000Z")], "251"),
			);
		const { getLabelerBadges } = await load();

		const pending = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);
		const labels = await pending;

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(urlOf(0).searchParams.get("cursor")).toBeNull();
		expect(urlOf(1).searchParams.get("cursor")).toBe("250");
		expect(labels.map((l) => l.val)).toContain("team");
	});

	it("reconciles a negation that lands on a later page", async () => {
		fetchMock
			.mockResolvedValueOnce(
				page(
					[
						row(A, "team", "2026-01-01T00:00:00.000Z"),
						...fill(QUERY_LIMIT - 1, B),
					],
					"250",
				),
			)
			.mockResolvedValueOnce(
				page([row(A, "team", "2026-02-01T00:00:00.000Z", true)]),
			);
		const { getLabelerBadges } = await load();

		const pending = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);
		const labels = await pending;

		expect(labels).toEqual([]);
	});

	it("drops an expired label", async () => {
		fetchMock.mockResolvedValue(
			page([
				{
					uri: A,
					val: "donator",
					cts: "2026-01-01T00:00:00.000Z",
					exp: "2026-01-02T00:00:00.000Z",
				},
			]),
		);
		vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
		const { getLabelerBadges } = await load();

		const pending = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);

		expect(await pending).toEqual([]);
	});

	it("degrades to no badges on failure and retries only after the failure TTL", async () => {
		fetchMock.mockRejectedValue(new Error("boom"));
		const { getLabelerBadges } = await load();

		const first = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);
		expect(await first).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(FAILURE_TTL_MS / 2);
		const second = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);
		await second;
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(FAILURE_TTL_MS);
		const third = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);
		await third;
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("serves a warm DID from memory without a request", async () => {
		fetchMock.mockResolvedValue(
			page([row(A, "team", "2026-01-01T00:00:00.000Z")]),
		);
		const { getLabelerBadges } = await load();

		const first = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);
		await first;

		const second = getLabelerBadges(A);
		await vi.advanceTimersByTimeAsync(FLUSH);

		expect(await second).toEqual(await first);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
