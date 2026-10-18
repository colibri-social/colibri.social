import { describe, expect, it, vi } from "vitest";
import {
	type Activity,
	activityIsLive,
	activityLabel,
	activitySummary,
	liveActivitiesOf,
	memberActivityOf,
	nextActivityEnd,
	nowPlayingOf,
} from "./activity";
import type { Presence } from "./types";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");

const listening: Activity = {
	kind: "listening",
	title: "Manual Drive 1991",
	subtitle: "DUSQK",
	detail: "Manual Drive 1991",
	imageUri: "https://appview.example/art.jpg",
	linkUri: "https://teal.fm/track/1",
	startedAt: "2026-06-01T11:58:00.000Z",
	source: "teal.fm",
};

const playing: Activity = {
	kind: "playing",
	title: "Celeste",
	subtitle: "Chapter 7",
	startedAt: "2026-06-01T11:59:00.000Z",
	source: "steam",
};

const withEnd = (endsAt: string) =>
	({ ...listening, endsAt }) as unknown as Activity;

const presenceWith = (...activities: Activity[]): Presence =>
	({ onlineState: "online", activities }) as Presence;

describe("activity labels", () => {
	it("names the kind and the service", () => {
		expect(activityLabel(listening)).toBe("Listening to teal.fm");
		expect(activityLabel(playing)).toBe("Playing");
		expect(
			activityLabel({ ...listening, kind: "streaming", source: "twitch.tv" }),
		).toBe("Streaming on twitch.tv");
		expect(activityLabel({ ...listening, kind: "reading" })).toBe("teal.fm");
	});

	it("summarises listening by artist and everything else by title", () => {
		expect(activitySummary(listening)).toBe("DUSQK");
		expect(activitySummary(playing)).toBe("Celeste · Chapter 7");
		expect(activitySummary({ ...playing, subtitle: undefined })).toBe(
			"Celeste",
		);
	});
});

describe("live activities", () => {
	it("treats an activity without an end, or a broken end, as live", () => {
		expect(activityIsLive(listening, NOW)).toBe(true);
		expect(activityIsLive(withEnd("soon"), NOW)).toBe(true);
		expect(activityIsLive(withEnd("2026-06-01T11:00:00.000Z"), NOW)).toBe(
			false,
		);
		expect(activityIsLive(undefined, NOW)).toBe(false);
	});

	it("drops lapsed entries and puts the newest first", () => {
		const lapsed = withEnd("2026-06-01T11:59:59.000Z");
		expect(
			liveActivitiesOf(presenceWith(listening, lapsed, playing), NOW),
		).toEqual([playing, listening]);
		expect(liveActivitiesOf(undefined, NOW)).toEqual([]);
	});
});

describe("nowPlayingOf", () => {
	it("maps live activities to profile cards", () => {
		const cards = nowPlayingOf(presenceWith(listening), undefined, NOW);
		expect(cards).toEqual([
			{
				kind: "listening",
				label: "Listening to teal.fm",
				source: "teal.fm",
				title: "Manual Drive 1991",
				artist: "DUSQK",
				album: "Manual Drive 1991",
				artSrc: "https://appview.example/art.jpg",
			},
		]);
	});

	it("links a card only when it can open the link safely", () => {
		const open = vi.fn();
		const [card] = nowPlayingOf(presenceWith(listening), open, NOW) ?? [];
		expect(card?.href).toBe("https://teal.fm/track/1");
		const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
		card?.onOpen?.(event);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(open).toHaveBeenCalledWith(
			"https://teal.fm/track/1",
			"Manual Drive 1991",
		);
	});

	it("returns nothing when no activity is live", () => {
		expect(nowPlayingOf(presenceWith(), undefined, NOW)).toBeUndefined();
	});
});

describe("memberActivityOf", () => {
	it("shows the newest activity and counts the rest", () => {
		expect(memberActivityOf(presenceWith(listening, playing), NOW)).toEqual({
			kind: "playing",
			summary: "Celeste · Chapter 7",
			more: 1,
		});
		expect(memberActivityOf(presenceWith(), NOW)).toBeUndefined();
	});
});

describe("activity expiry", () => {
	it("finds the nearest end that is still ahead", () => {
		const presence = presenceWith(
			withEnd("2026-06-01T12:05:00.000Z"),
			withEnd("2026-06-01T12:01:00.000Z"),
			withEnd("2026-06-01T11:59:00.000Z"),
			playing,
		);
		expect(nextActivityEnd(presence, NOW)).toBe(
			Date.parse("2026-06-01T12:01:00.000Z"),
		);
		expect(nextActivityEnd(presenceWith(playing), NOW)).toBeUndefined();
	});
});
