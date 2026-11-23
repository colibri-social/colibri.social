import { describe, expect, it } from "vitest";
import {
	APP_RELEASE_NOTES,
	isSpacesRelease,
	releaseNotesFor,
} from "./release-notes";

describe("isSpacesRelease", () => {
	it("accepts the launch release and everything after it", () => {
		expect(isSpacesRelease("0.7.0")).toBe(true);
		expect(isSpacesRelease("0.7.1")).toBe(true);
		expect(isSpacesRelease("0.8.0")).toBe(true);
		expect(isSpacesRelease("1.0.0")).toBe(true);
	});

	it("keeps the local preview release", () => {
		expect(isSpacesRelease("0.0.0-preview")).toBe(true);
	});

	it("rejects releases from before the launch", () => {
		expect(isSpacesRelease("0.6.0-spaces.37")).toBe(false);
		expect(isSpacesRelease("0.5.1")).toBe(false);
		expect(isSpacesRelease("0.4.0")).toBe(false);
		expect(isSpacesRelease("0.1.0-rc.15")).toBe(false);
	});
});

describe("APP_RELEASE_NOTES", () => {
	it("only lists releases from the launch onward", () => {
		for (const note of APP_RELEASE_NOTES) {
			expect(isSpacesRelease(note.version)).toBe(true);
		}
	});
});

describe("releaseNotesFor", () => {
	it("keeps each entry's icon", () => {
		const [note] = releaseNotesFor(
			[
				{
					version: "0.8.0",
					date: "2026-11-20",
					entries: [
						{
							title: "A new look",
							body: "Everything got a new design.",
							icon: "palette",
							kind: "feature",
							platforms: ["web"],
						},
					],
				},
			],
			"web",
		);
		expect(note?.entries[0]?.icon).toBe("palette");
	});
});
