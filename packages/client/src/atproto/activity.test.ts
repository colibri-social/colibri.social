import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity, Presence } from "./views";

const load = async () => {
	vi.resetModules();
	return await import("./activity");
};

const activity = (patch: Partial<Activity> = {}): Activity => ({
	kind: "listening",
	title: "Never Gonna Give You Up",
	subtitle: "Rick Astley",
	detail: "Never Gonna Give You Up",
	imageUri: "https://appview.example/xrpc/social.colibri.beta.blob.get?cid=one",
	linkUri: "https://www.last.fm/music/Rick+Astley/_/Never+Gonna+Give+You+Up",
	source: "teal.fm",
	...patch,
});

const presenceWith = (value: Activity | undefined): Presence =>
	({ onlineState: "online", activity: value }) as Presence;

describe("activityLabel", () => {
	it("names the source for a listening activity", async () => {
		const { activityLabel } = await load();
		expect(activityLabel(activity())).toBe("Listening to teal.fm");
	});

	it("leaves the source out of a playing activity", async () => {
		const { activityLabel } = await load();
		expect(activityLabel(activity({ kind: "playing", source: "Steam" }))).toBe(
			"Playing",
		);
	});

	it("falls back to the bare source for an unrecognised kind", async () => {
		const { activityLabel } = await load();
		expect(
			activityLabel(activity({ kind: "cooking", source: "recipes.example" })),
		).toBe("recipes.example");
	});
});

describe("activityIsLive", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-25T13:20:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("treats an activity with no end as live", async () => {
		const { activityIsLive } = await load();
		expect(activityIsLive(activity({ endsAt: undefined }))).toBe(true);
	});

	it("treats an activity ending in the future as live", async () => {
		const { activityIsLive } = await load();
		expect(activityIsLive(activity({ endsAt: "2026-08-25T13:29:54Z" }))).toBe(
			true,
		);
	});

	it("treats a lapsed activity as not live", async () => {
		const { activityIsLive } = await load();
		expect(activityIsLive(activity({ endsAt: "2026-08-25T13:19:54Z" }))).toBe(
			false,
		);
	});

	it("keeps an activity whose end date cannot be parsed", async () => {
		const { activityIsLive } = await load();
		expect(
			activityIsLive(activity({ endsAt: "not a date" as Activity["endsAt"] })),
		).toBe(true);
	});

	it("reports nothing as not live", async () => {
		const { activityIsLive } = await load();
		expect(activityIsLive(undefined)).toBe(false);
	});
});

describe("liveActivityOf", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-25T13:20:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("reads the activity off a presence", async () => {
		const { liveActivityOf } = await load();
		const current = activity();
		expect(liveActivityOf(presenceWith(current))).toEqual(current);
	});

	it("withholds a lapsed activity", async () => {
		const { liveActivityOf } = await load();
		expect(
			liveActivityOf(
				presenceWith(activity({ endsAt: "2026-08-25T13:00:00Z" })),
			),
		).toBeUndefined();
	});

	it("copes with a presence that carries no activity", async () => {
		const { liveActivityOf } = await load();
		expect(liveActivityOf(presenceWith(undefined))).toBeUndefined();
		expect(liveActivityOf(undefined)).toBeUndefined();
	});
});

describe("activitySummary", () => {
	it("joins the title and subtitle", async () => {
		const { activitySummary } = await load();
		expect(activitySummary(activity())).toBe(
			"Never Gonna Give You Up · Rick Astley",
		);
	});

	it("uses the title alone when there is no subtitle", async () => {
		const { activitySummary } = await load();
		expect(activitySummary(activity({ subtitle: undefined }))).toBe(
			"Never Gonna Give You Up",
		);
	});
});

describe("warmActivityImage", () => {
	let created: Array<{ src: string }>;

	beforeEach(() => {
		created = [];
		vi.stubGlobal(
			"Image",
			class {
				src = "";
				constructor() {
					created.push(this);
				}
			},
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("prefetches an image once, however many times it is requested", async () => {
		const { warmActivityImage } = await load();
		warmActivityImage("https://appview.example/one.png");
		warmActivityImage("https://appview.example/one.png");
		expect(created).toHaveLength(1);
		expect(created[0]?.src).toBe("https://appview.example/one.png");
	});

	it("prefetches each distinct image", async () => {
		const { warmActivityImage } = await load();
		warmActivityImage("https://appview.example/one.png");
		warmActivityImage("https://appview.example/two.png");
		expect(created).toHaveLength(2);
	});

	it("does nothing without an image", async () => {
		const { warmActivityImage } = await load();
		warmActivityImage(undefined);
		expect(created).toHaveLength(0);
	});

	it("skips activities that carry no image", async () => {
		const { warmActivityImages } = await load();
		warmActivityImages([
			activity(),
			undefined,
			activity({ imageUri: undefined }),
		]);
		expect(created).toHaveLength(1);
	});
});
