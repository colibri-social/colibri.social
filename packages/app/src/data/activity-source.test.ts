import { describe, expect, it, vi } from "vitest";
import {
	ABSENT_TTL_MS,
	createActivitySourceDetector,
	FAILURE_TTL_MS,
} from "./activity-source";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const detectorWith = (
	present: readonly string[],
	options: { now?: () => number; failing?: boolean } = {},
) => {
	const fetcher = vi.fn(async (input: RequestInfo | URL) => {
		if (options.failing) return json({ error: "InternalServerError" }, 500);
		const collection = new URL(String(input)).searchParams.get("collection");
		return json({
			records: collection && present.includes(collection) ? [{}] : [],
		});
	});
	const detector = createActivitySourceDetector({
		resolvePds: async () => "pds.example.com",
		fetcher: fetcher as unknown as typeof fetch,
		now: options.now,
	});
	return { detector, fetcher };
};

describe("activity source detection", () => {
	it("reads only the person's own PDS", async () => {
		const { detector, fetcher } = detectorWith(["fm.teal.feed.play"]);
		expect(await detector.detect("did:plc:a")).toBe("teal.fm");
		for (const [input] of fetcher.mock.calls) {
			const url = new URL(String(input));
			expect(url.host).toBe("pds.example.com");
			expect(url.pathname).toBe("/xrpc/com.atproto.repo.listRecords");
			expect(url.searchParams.get("repo")).toBe("did:plc:a");
		}
	});

	it("checks the services in order", async () => {
		const { detector } = detectorWith([
			"app.rocksky.scrobble",
			"fm.atradio.favorite",
		]);
		expect(await detector.detect("did:plc:a")).toBe("rocksky.app");
	});

	it("caches a miss briefly and then looks again", async () => {
		let clock = 0;
		const { detector, fetcher } = detectorWith([], { now: () => clock });
		expect(await detector.detect("did:plc:a")).toBeNull();
		const calls = fetcher.mock.calls.length;
		expect(await detector.detect("did:plc:a")).toBeNull();
		expect(fetcher.mock.calls.length).toBe(calls);
		clock += ABSENT_TTL_MS + 1;
		await detector.detect("did:plc:a");
		expect(fetcher.mock.calls.length).toBe(calls * 2);
	});

	it("shares one lookup between callers", async () => {
		const { detector, fetcher } = detectorWith(["fm.teal.actor.status"]);
		const [first, second] = await Promise.all([
			detector.detect("did:plc:a"),
			detector.detect("did:plc:a"),
		]);
		expect(first).toBe("teal.fm");
		expect(second).toBe("teal.fm");
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("treats a failing PDS as no source for a short while", async () => {
		let clock = 0;
		const { detector, fetcher } = detectorWith([], {
			failing: true,
			now: () => clock,
		});
		expect(await detector.detect("did:plc:a")).toBeNull();
		expect(await detector.detect("did:plc:a")).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
		clock += FAILURE_TTL_MS + 1;
		await detector.detect("did:plc:a");
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
