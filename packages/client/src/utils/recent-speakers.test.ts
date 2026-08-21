import { beforeEach, describe, expect, it } from "vitest";
import {
	forgetSpeakers,
	recordSpeaker,
	recordSpeakers,
	speakerRanks,
} from "./recent-speakers";

const COMMUNITY = "at://did:plc:one/social.colibri.community/self";
const OTHER = "at://did:plc:two/social.colibri.community/self";

const spoke = (did: string, createdAt: string) => ({
	author: { did },
	createdAt,
});

describe("recent speakers", () => {
	beforeEach(() => {
		forgetSpeakers(COMMUNITY);
		forgetSpeakers(OTHER);
	});

	it("ranks the most recent speaker first", () => {
		recordSpeakers(COMMUNITY, [
			spoke("did:plc:a", "2026-08-21T10:00:00.000Z"),
			spoke("did:plc:b", "2026-08-21T12:00:00.000Z"),
			spoke("did:plc:c", "2026-08-21T11:00:00.000Z"),
		]);

		const ranks = speakerRanks(COMMUNITY);

		expect(ranks.top(3)).toEqual(["did:plc:b", "did:plc:c", "did:plc:a"]);
		expect(ranks.rank("did:plc:b")).toBe(0);
		expect(ranks.rank("did:plc:a")).toBe(2);
		expect(ranks.size).toBe(3);
	});

	it("keeps the newest timestamp per speaker", () => {
		recordSpeakers(COMMUNITY, [
			spoke("did:plc:a", "2026-08-21T12:00:00.000Z"),
			spoke("did:plc:b", "2026-08-21T11:00:00.000Z"),
			spoke("did:plc:a", "2026-08-21T09:00:00.000Z"),
		]);

		expect(speakerRanks(COMMUNITY).top(2)).toEqual(["did:plc:a", "did:plc:b"]);
	});

	it("promotes a speaker on a newer single message", () => {
		recordSpeakers(COMMUNITY, [
			spoke("did:plc:a", "2026-08-21T12:00:00.000Z"),
			spoke("did:plc:b", "2026-08-21T11:00:00.000Z"),
		]);
		recordSpeaker(COMMUNITY, "did:plc:b", "2026-08-21T13:00:00.000Z");

		expect(speakerRanks(COMMUNITY).top(2)).toEqual(["did:plc:b", "did:plc:a"]);
	});

	it("ignores an older single message", () => {
		recordSpeaker(COMMUNITY, "did:plc:a", "2026-08-21T12:00:00.000Z");
		recordSpeaker(COMMUNITY, "did:plc:b", "2026-08-21T11:00:00.000Z");
		recordSpeaker(COMMUNITY, "did:plc:b", "2026-08-21T08:00:00.000Z");

		expect(speakerRanks(COMMUNITY).top(2)).toEqual(["did:plc:a", "did:plc:b"]);
	});

	it("keeps communities apart", () => {
		recordSpeaker(COMMUNITY, "did:plc:a", "2026-08-21T12:00:00.000Z");
		recordSpeaker(OTHER, "did:plc:z", "2026-08-21T13:00:00.000Z");

		expect(speakerRanks(COMMUNITY).top(5)).toEqual(["did:plc:a"]);
		expect(speakerRanks(OTHER).top(5)).toEqual(["did:plc:z"]);
	});

	it("reports no ranks for an unknown community", () => {
		const ranks = speakerRanks("at://did:plc:nobody/x/self");

		expect(ranks.size).toBe(0);
		expect(ranks.top(5)).toEqual([]);
		expect(ranks.rank("did:plc:a")).toBeUndefined();
	});

	it("evicts the oldest speakers past the cap", () => {
		const many = Array.from({ length: 600 }, (_, i) =>
			spoke(
				`did:plc:${i}`,
				new Date(1_000_000_000_000 + i * 1000).toISOString(),
			),
		);

		recordSpeakers(COMMUNITY, many);
		const ranks = speakerRanks(COMMUNITY);

		expect(ranks.size).toBe(500);
		expect(ranks.top(1)).toEqual(["did:plc:599"]);
		expect(ranks.rank("did:plc:0")).toBeUndefined();
		expect(ranks.rank("did:plc:99")).toBeUndefined();
		expect(ranks.rank("did:plc:100")).toBe(499);
	});

	it("tolerates an unparseable timestamp", () => {
		recordSpeaker(COMMUNITY, "did:plc:a", "not a date");
		recordSpeaker(COMMUNITY, "did:plc:b", "2026-08-21T12:00:00.000Z");

		expect(speakerRanks(COMMUNITY).top(2)).toEqual(["did:plc:b", "did:plc:a"]);
	});
});
