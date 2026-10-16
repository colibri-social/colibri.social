import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LabelerTransport, LabelPage } from "./labeler";
import {
	type BadgeDefinition,
	indexDefinitions,
	parseDefinitions,
	primaryBadge,
	type RawLabel,
	resolveActiveLabels,
	sortBadges,
} from "./parse";
import {
	createBadgeStore,
	FAILURE_TTL_MS,
	FLUSH_WINDOW_MS,
	LABELS_TTL_MS,
} from "./store";

const BOT: BadgeDefinition = {
	identifier: "bot",
	name: "BOT",
	description: "Self-declared to be automated",
};

const FALLBACKS: BadgeDefinition[] = [
	{
		identifier: "team",
		name: "TEAM",
		description: "Official Colibri Maintainer",
		precedence: 0,
		appearance: { variant: "solid", colors: ["#8b5cf6"], foreground: "#fff" },
	},
	{
		identifier: "donator",
		name: "DONATOR",
		description: "Made a donation to support Colibri",
		precedence: 5,
		appearance: {
			variant: "solid",
			colors: ["#2dd4bf"],
			foreground: "#000000",
		},
	},
];

const label = (uri: string, val: string, extra: Partial<RawLabel> = {}) => ({
	uri,
	val,
	cts: "2026-01-01T00:00:00.000Z",
	...extra,
});

describe("parseDefinitions", () => {
	it("keeps valid entries and drops broken ones", () => {
		const parsed = parseDefinitions({
			badgeDefinitions: [
				{
					identifier: "team",
					name: "TEAM",
					description: "Maintainer",
					precedence: 0,
					appearance: {
						variant: "gradientBorder",
						colors: ["#ff4d4d", "#ffcc00"],
						foreground: "#ffffff",
					},
				},
				{ identifier: "", name: "EMPTY", description: "" },
				{ identifier: "nameless", description: "" },
				{
					identifier: "bad-color",
					name: "BAD",
					description: "",
					appearance: { colors: ["red"], foreground: "#ffffff" },
				},
			],
		});
		expect(parsed.map((entry) => entry.identifier)).toEqual([
			"team",
			"bad-color",
		]);
		expect(parsed[0]?.appearance?.variant).toBe("gradientBorder");
		expect(parsed[1]?.appearance).toBeUndefined();
	});

	it("returns nothing for a record without definitions", () => {
		expect(parseDefinitions(undefined)).toEqual([]);
		expect(parseDefinitions({ badgeDefinitions: "team" })).toEqual([]);
	});
});

describe("resolveActiveLabels", () => {
	const now = Date.parse("2026-06-01T00:00:00.000Z");

	it("lets the newest label for a value win, then drops negations", () => {
		const active = resolveActiveLabels(
			[
				label("did:a", "team", { cts: "2026-01-01T00:00:00.000Z" }),
				label("did:a", "team", { cts: "2026-02-01T00:00:00.000Z", neg: true }),
				label("did:a", "donator"),
			],
			now,
		);
		expect(active.map((entry) => entry.val)).toEqual(["donator"]);
	});

	it("drops expired labels", () => {
		const active = resolveActiveLabels(
			[
				label("did:a", "team", { exp: "2026-05-01T00:00:00.000Z" }),
				label("did:a", "donator", { exp: "2026-07-01T00:00:00.000Z" }),
			],
			now,
		);
		expect(active.map((entry) => entry.val)).toEqual(["donator"]);
	});
});

describe("badge order", () => {
	const index = indexDefinitions(FALLBACKS, FALLBACKS, BOT);

	it("sorts by precedence, unknown badges after known ones and bot last", () => {
		expect(
			sortBadges(index, ["mystery", "donator", "team"], { isBot: true }),
		).toEqual(["team", "donator", "mystery", "bot"]);
	});

	it("uses the preferred badge only when the user has it", () => {
		const sorted = sortBadges(index, ["donator", "team"], {});
		expect(primaryBadge(sorted, "donator")).toBe("donator");
		expect(primaryBadge(sorted, "sponsor-twenty-five")).toBe("team");
	});

	it("fills a missing appearance from the built-in badge", () => {
		const published = indexDefinitions(
			[{ identifier: "team", name: "STAFF", description: "", precedence: 0 }],
			FALLBACKS,
			BOT,
		);
		expect(published.get("team")?.name).toBe("STAFF");
		expect(published.get("team")?.appearance?.colors).toEqual(["#8b5cf6"]);
		expect(published.has("donator")).toBe(false);
		expect(published.get("bot")).toBe(BOT);
	});
});

const transportWith = (
	queryLabels: (dids: readonly string[]) => Promise<LabelPage>,
	definitions: () => Promise<BadgeDefinition[]> = async () => [],
): LabelerTransport & {
	queryLabels: ReturnType<typeof vi.fn>;
} => ({
	queryLabels: vi.fn(queryLabels),
	definitions,
});

describe("createBadgeStore", () => {
	let clock = Date.parse("2026-06-01T00:00:00.000Z");

	beforeEach(() => {
		vi.useFakeTimers();
		clock = Date.parse("2026-06-01T00:00:00.000Z");
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const storeFor = (transport: LabelerTransport) =>
		createBadgeStore({
			transport,
			fallbacks: FALLBACKS,
			bot: BOT,
			now: () => clock,
		});

	it("batches the people it sees into one lookup", async () => {
		const transport = transportWith(async (dids) => ({
			labels: dids.map((did) => label(did, "team")),
			truncated: false,
		}));
		const store = storeFor(transport);
		expect(store.primary({ did: "did:a" })).toBeUndefined();
		store.primary({ did: "did:b" });
		store.primary({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(transport.queryLabels).toHaveBeenCalledTimes(1);
		expect(transport.queryLabels).toHaveBeenCalledWith(["did:a", "did:b"]);
		expect(store.primary({ did: "did:a" })?.name).toBe("TEAM");
		expect(store.all({ did: "did:b", isBot: true }).map((d) => d.name)).toEqual(
			["TEAM", "BOT"],
		);
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(transport.queryLabels).toHaveBeenCalledTimes(1);
	});

	it("splits large sets into chunks of fifty", async () => {
		const transport = transportWith(async () => ({
			labels: [],
			truncated: false,
		}));
		const store = storeFor(transport);
		for (let index = 0; index < 120; index++) {
			store.all({ did: `did:${index}` });
		}
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		const sizes = transport.queryLabels.mock.calls.map(
			(call) => (call[0] as string[]).length,
		);
		expect(sizes).toEqual([50, 50, 20]);
	});

	it("looks people up again once their badges go stale", async () => {
		const transport = transportWith(async () => ({
			labels: [],
			truncated: false,
		}));
		const store = storeFor(transport);
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		clock += LABELS_TTL_MS - 1;
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(transport.queryLabels).toHaveBeenCalledTimes(1);
		clock += 2;
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(transport.queryLabels).toHaveBeenCalledTimes(2);
	});

	it("keeps known badges when a refresh fails and retries later", async () => {
		let fail = false;
		const transport = transportWith(async (dids) => {
			if (fail) throw new TypeError("Failed to fetch");
			return {
				labels: dids.map((did) => label(did, "team")),
				truncated: false,
			};
		});
		const store = storeFor(transport);
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		fail = true;
		clock += LABELS_TTL_MS + 1;
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(store.primary({ did: "did:a" })?.name).toBe("TEAM");
		clock += FAILURE_TTL_MS + 1;
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(transport.queryLabels).toHaveBeenCalledTimes(3);
	});

	it("switches to the published badge list once it loads", async () => {
		const transport = transportWith(
			async (dids) => ({
				labels: dids.map((did) => label(did, "backer-five")),
				truncated: false,
			}),
			async () => [
				{
					identifier: "backer-five",
					name: "$5 BACKER",
					description: "Backs Colibri",
					precedence: 4,
				},
			],
		);
		const store = storeFor(transport);
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		await store.ensureDefinitions();
		expect(store.primary({ did: "did:a" })?.name).toBe("$5 BACKER");
	});

	it("lets the published team colour win over the built-in token", async () => {
		let publish: () => void = () => {};
		const published = new Promise<void>((resolve) => {
			publish = resolve;
		});
		const transport = transportWith(
			async (dids) => ({
				labels: dids.map((did) => label(did, "team")),
				truncated: false,
			}),
			async () => {
				await published;
				return [
					{
						identifier: "team",
						name: "TEAM",
						description: "Official Colibri Maintainer",
						precedence: 0,
						appearance: {
							variant: "solid",
							colors: ["#8b5cf6"],
							foreground: "#fafafa",
						},
					},
				];
			},
		);
		const store = createBadgeStore({
			transport,
			fallbacks: [
				{
					identifier: "team",
					name: "TEAM",
					description: "Official Colibri Maintainer",
					precedence: 0,
					appearance: {
						variant: "solid",
						colors: ["var(--primary-fill)"],
						foreground: "var(--primary-foreground)",
					},
				},
			],
			bot: BOT,
			now: () => clock,
		});
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(store.primary({ did: "did:a" })?.appearance?.colors).toEqual([
			"var(--primary-fill)",
		]);
		publish();
		await store.ensureDefinitions();
		expect(store.primary({ did: "did:a" })?.appearance).toEqual({
			variant: "solid",
			colors: ["#8b5cf6"],
			foreground: "#fafafa",
		});
	});

	it("names a badge it has no definition for from its value", async () => {
		const transport = transportWith(async (dids) => ({
			labels: dids.map((did) => label(did, "early-bird")),
			truncated: false,
		}));
		const store = storeFor(transport);
		store.all({ did: "did:a" });
		await vi.advanceTimersByTimeAsync(FLUSH_WINDOW_MS);
		expect(store.primary({ did: "did:a" })?.name).toBe("EARLY BIRD");
	});

	it("leaves the bot badge out on request", async () => {
		const store = storeFor(
			transportWith(async () => ({ labels: [], truncated: false })),
		);
		expect(store.primary({ did: "did:a", isBot: true })?.name).toBe("BOT");
		expect(
			store.primary({ did: "did:a", isBot: true }, { withoutBot: true }),
		).toBeUndefined();
	});
});
