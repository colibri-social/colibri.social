import { describe, expect, it } from "vitest";
import { readableUserColor } from "./readable-color";

describe("readableUserColor", () => {
	it("leaves every colour untouched in dark mode", () => {
		expect(readableUserColor("#ffffff", "dark")).toBe("#ffffff");
		expect(readableUserColor("#000000", "dark")).toBe("#000000");
		expect(readableUserColor("#a3e635", "dark")).toBe("#a3e635");
	});

	it("passes through values it cannot parse", () => {
		expect(readableUserColor(undefined, "light")).toBeUndefined();
		expect(readableUserColor("rebeccapurple", "light")).toBe("rebeccapurple");
		expect(readableUserColor("#12345", "light")).toBe("#12345");
	});

	it("leaves colours that already contrast on light backgrounds", () => {
		expect(readableUserColor("#1e3a8a", "light")).toBe("#1e3a8a");
		expect(readableUserColor("#000000", "light")).toBe("#000000");
	});

	it("darkens colours that would wash out on light backgrounds", () => {
		expect(readableUserColor("#ffffff", "light")).toBe("#777777");
		expect(readableUserColor("#ffff00", "light")).toBe("#7b7b00");
	});

	it("keeps the hue while darkening", () => {
		expect(readableUserColor("#22d3ee", "light")).toBe("#158293");
		expect(readableUserColor("#ef4444", "light")).toBe("#d83d3d");
	});

	it("expands shorthand hex", () => {
		expect(readableUserColor("#fff", "light")).toBe(
			readableUserColor("#ffffff", "light"),
		);
	});

	it("ignores an alpha channel", () => {
		expect(readableUserColor("#ffffff80", "light")).toBe(
			readableUserColor("#ffffff", "light"),
		);
	});
});
