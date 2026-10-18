import { describe, expect, it } from "vitest";
import { utf8Length } from "./text-length";

describe("utf8Length", () => {
	it("counts ASCII as one byte each", () => {
		expect(utf8Length("hello")).toBe(5);
	});

	it("counts umlauts as two bytes", () => {
		expect(utf8Length("ü")).toBe(2);
	});

	it("counts emoji by their encoded bytes", () => {
		expect(utf8Length("🐦")).toBe(4);
		expect(utf8Length("👍🏽")).toBe(8);
	});
});
