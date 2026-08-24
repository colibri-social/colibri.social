import { describe, expect, it } from "vitest";
import { isLegacyImmutable } from "./message-legacy";

describe("isLegacyImmutable", () => {
	it("is false when legacy is absent", () => {
		expect(isLegacyImmutable({})).toBe(false);
	});

	it("is false when legacy is explicitly false", () => {
		expect(isLegacyImmutable({ legacy: false })).toBe(false);
	});

	it("is true when legacy is true", () => {
		expect(isLegacyImmutable({ legacy: true })).toBe(true);
	});
});
