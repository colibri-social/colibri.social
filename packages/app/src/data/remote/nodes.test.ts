import { describe, expect, it, vi } from "vitest";
import {
	createNodeDirectory,
	LIST_NODES_PATH,
	REFRESH_AFTER_MS,
	STORAGE_KEY,
} from "./nodes";

const MAIN = "https://spaces-api.colibri.test";

const memoryStorage = () => {
	const values = new Map<string, string>();

	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
		values,
	};
};

const listing = [
	{
		id: "hel-1",
		region: "eu",
		roles: ["main", "api", "live", "voice"],
		endpoint: "https://hel-1.nodes.colibri.test",
		probeUrl: "https://hel-1.nodes.colibri.test/health",
	},
	{
		id: "us-1",
		region: "us",
		roles: ["api", "live"],
		endpoint: "https://us-1.nodes.colibri.test/",
		probeUrl: "https://us-1.nodes.colibri.test/health",
	},
	{
		id: "voice-1",
		region: "eu",
		roles: ["voice"],
		endpoint: "https://voice-1.nodes.colibri.test",
		probeUrl: "https://voice-1.nodes.colibri.test/health",
	},
	{
		id: "down-1",
		region: "eu",
		roles: ["api", "live"],
		endpoint: "https://down-1.nodes.colibri.test",
		probeUrl: "https://down-1.nodes.colibri.test/health",
	},
];

const fakeNetwork = (latency: Record<string, number>) => {
	let clock = 1_000_000;
	const request = vi.fn(async (input: string | URL) => {
		const url = new URL(String(input));

		if (url.pathname === LIST_NODES_PATH) {
			return new Response(JSON.stringify({ nodes: listing }));
		}

		const delay = latency[url.host];

		if (delay === undefined) throw new TypeError("network error");

		clock += delay;

		return new Response("{}");
	});

	return {
		request: request as unknown as typeof fetch,
		now: () => clock,
		calls: request,
	};
};

describe("createNodeDirectory", () => {
	it("measures every node and picks the fastest one for each role", async () => {
		const network = fakeNetwork({
			"hel-1.nodes.colibri.test": 40,
			"us-1.nodes.colibri.test": 12,
			"voice-1.nodes.colibri.test": 30,
		});
		const directory = createNodeDirectory({
			mainUrl: MAIN,
			fetch: network.request,
			now: network.now,
			storage: memoryStorage(),
		});

		await directory.refresh();

		expect(directory.nodes().map((node) => [node.id, node.rttMs])).toEqual([
			["us-1", 12],
			["voice-1", 30],
			["hel-1", 40],
		]);
		expect(directory.endpointFor("live")).toBe(
			"https://us-1.nodes.colibri.test",
		);
		expect(directory.endpointFor("voice")).toBe(
			"https://voice-1.nodes.colibri.test",
		);
		expect(
			directory.endpointFor(
				"live",
				new Set(["https://us-1.nodes.colibri.test"]),
			),
		).toBe("https://hel-1.nodes.colibri.test");
		expect(
			directory.nodeAt("https://hel-1.nodes.colibri.test/xrpc/x")?.id,
		).toBe("hel-1");
	});

	it("remembers the measurement for the next start", async () => {
		const storage = memoryStorage();
		const network = fakeNetwork({
			"hel-1.nodes.colibri.test": 5,
			"us-1.nodes.colibri.test": 9,
		});

		await createNodeDirectory({
			mainUrl: MAIN,
			fetch: network.request,
			now: network.now,
			storage,
		}).refresh();

		const next = createNodeDirectory({
			mainUrl: MAIN,
			fetch: network.request,
			now: network.now,
			storage,
		});

		expect(next.endpointFor("live")).toBe("https://hel-1.nodes.colibri.test");
		expect(storage.values.has(STORAGE_KEY)).toBe(true);

		const other = createNodeDirectory({
			mainUrl: "https://other-appview.test",
			fetch: network.request,
			now: network.now,
			storage,
		});

		expect(other.nodes()).toEqual([]);
	});

	it("falls back to nothing on an AppView without nodes", async () => {
		const directory = createNodeDirectory({
			mainUrl: MAIN,
			fetch: (async () =>
				new Response("", { status: 501 })) as unknown as typeof fetch,
			storage: null,
		});

		await directory.refresh();

		expect(directory.nodes()).toEqual([]);
		expect(directory.endpointFor("live")).toBeNull();
	});

	it("measures again only once the last measurement is old", async () => {
		const network = fakeNetwork({ "hel-1.nodes.colibri.test": 5 });
		let clock = 0;
		const directory = createNodeDirectory({
			mainUrl: MAIN,
			fetch: network.request,
			now: () => clock,
			storage: null,
		});

		await directory.refresh();

		const listed = () =>
			network.calls.mock.calls.filter(([url]) =>
				String(url).includes(LIST_NODES_PATH),
			).length;

		await directory.refreshIfStale();
		expect(listed()).toBe(1);

		clock += REFRESH_AFTER_MS;
		await directory.refreshIfStale();
		expect(listed()).toBe(2);
	});
});
