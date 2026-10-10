import { describe, expect, it } from "vitest";
import {
	contrastRatio,
	pickNameColor,
	readableUserColor,
	resolveNameColor,
	themedColor,
	topRoleColor,
} from "./name-color";

const DARK_SURFACE = "#2c2c2c";
const LIGHT_SURFACE = "#e4e4e6";

describe("readableUserColor", () => {
	it("passes through values it cannot parse", () => {
		expect(readableUserColor(undefined, "light")).toBeUndefined();
		expect(readableUserColor(undefined, "dark")).toBeUndefined();
		expect(readableUserColor("rebeccapurple", "light")).toBe("rebeccapurple");
		expect(readableUserColor("#12345", "dark")).toBe("#12345");
	});

	it("leaves colours that already contrast", () => {
		expect(readableUserColor("#1e3a8a", "light")).toBe("#1e3a8a");
		expect(readableUserColor("#000000", "light")).toBe("#000000");
		expect(readableUserColor("#ffffff", "dark")).toBe("#ffffff");
		expect(readableUserColor("#a3e635", "dark")).toBe("#a3e635");
		expect(readableUserColor("#c4a7ff", "dark")).toBe("#c4a7ff");
	});

	it("darkens colours that would wash out on light surfaces", () => {
		for (const color of ["#ffffff", "#ffff00", "#22d3ee", "#ef4444"]) {
			const readable = readableUserColor(color, "light") as string;
			expect(readable).not.toBe(color);
			expect(contrastRatio(readable, LIGHT_SURFACE)).toBeGreaterThanOrEqual(
				4.5,
			);
		}
	});

	it("lightens colours that would vanish on dark surfaces", () => {
		for (const color of ["#000000", "#0000ff", "#3b0764", "#8e51ff"]) {
			const readable = readableUserColor(color, "dark") as string;
			expect(readable).not.toBe(color);
			expect(contrastRatio(readable, DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("changes colours as little as needed", () => {
		const readable = readableUserColor("#ffffff", "light") as string;
		const slightlyLighter = `#${(Number.parseInt(readable.slice(1, 3), 16) + 2)
			.toString(16)
			.repeat(3)}`;
		expect(contrastRatio(slightlyLighter, LIGHT_SURFACE)).toBeLessThan(4.5);
	});

	it("keeps the hue while darkening", () => {
		const readable = readableUserColor("#ff0000", "light") as string;
		expect(readable.slice(3)).toBe("0000");
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

describe("pickNameColor", () => {
	it("uses the user's colour in chat", () => {
		expect(pickNameColor({ userColor: "#ff0000", context: "chat" })).toBe(
			"#ff0000",
		);
	});

	it("lets a role colour override the user's colour in chat", () => {
		expect(
			pickNameColor({
				userColor: "#ff0000",
				roleColor: "#00ff00",
				context: "chat",
			}),
		).toBe("#00ff00");
	});

	it("never uses the user's colour in the member list", () => {
		expect(
			pickNameColor({ userColor: "#ff0000", context: "member-list" }),
		).toBeUndefined();
		expect(
			pickNameColor({
				userColor: "#ff0000",
				roleColor: "#00ff00",
				context: "member-list",
			}),
		).toBe("#00ff00");
	});

	it("drops user colours when the Space overrides them", () => {
		expect(
			pickNameColor({
				userColor: "#ff0000",
				context: "chat",
				overrideUserColors: true,
			}),
		).toBeUndefined();
		expect(
			pickNameColor({
				userColor: "#ff0000",
				roleColor: "#00ff00",
				context: "chat",
				overrideUserColors: true,
			}),
		).toBe("#00ff00");
	});
});

describe("resolveNameColor", () => {
	it("returns both theme variants", () => {
		const color = resolveNameColor({ userColor: "#ffffff", context: "chat" });
		expect(color?.dark).toBe("#ffffff");
		expect(color?.light).toBe(readableUserColor("#ffffff", "light"));
	});

	it("returns nothing without a colour", () => {
		expect(resolveNameColor({ context: "chat" })).toBeUndefined();
		expect(themedColor("")).toBeUndefined();
	});
});

describe("topRoleColor", () => {
	it("picks the highest positioned role with a colour", () => {
		expect(
			topRoleColor([
				{ color: "#111111", position: 1 },
				{ position: 9 },
				{ color: "#222222", position: 5 },
			]),
		).toBe("#222222");
	});

	it("returns nothing without coloured roles", () => {
		expect(topRoleColor([{ position: 3 }])).toBeUndefined();
		expect(topRoleColor(undefined)).toBeUndefined();
	});
});
