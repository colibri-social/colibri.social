import { describe, expect, it } from "vitest";
import { bioError, displayNameError, graphemeLength } from "./profile-limits";

describe("profile limits", () => {
	it("counts graphemes", () => {
		expect(graphemeLength("👩‍👩‍👧‍👦a")).toBe(2);
	});

	it("requires a display name within the lexicon limits", () => {
		expect(displayNameError("  ")).toBeDefined();
		expect(displayNameError("Lou")).toBeUndefined();
		expect(displayNameError("a".repeat(65))).toBeDefined();
		expect(displayNameError("👩‍👩‍👧‍👦".repeat(40))).toBeDefined();
	});

	it("caps the bio", () => {
		expect(bioError("")).toBeUndefined();
		expect(bioError("b".repeat(256))).toBeUndefined();
		expect(bioError("b".repeat(257))).toBeDefined();
	});
});
