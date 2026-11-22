import { describe, expect, it } from "vitest";
import { formatMessageTime, formatShortTime } from "./time";

const plain = (value: string) => value.replace(/[  ]/g, " ");

const NOW = new Date(2026, 9, 14, 9, 41);

const format = (value: Date, now: Date = NOW, locale = "en-US") =>
	plain(formatMessageTime(value, now, locale));

describe("formatShortTime", () => {
	it("follows the locale's short time style", () => {
		const value = new Date(2026, 9, 14, 9, 41);
		expect(plain(formatShortTime(value, "en-US"))).toBe("9:41 AM");
		expect(formatShortTime(value, "de-DE")).toBe("09:41");
	});
});

describe("formatMessageTime", () => {
	it("shows only the time for messages sent today", () => {
		expect(format(new Date(2026, 9, 14, 8, 5))).toBe("8:05 AM");
		expect(format(new Date(2026, 9, 14, 8, 5), NOW, "de-DE")).toBe("08:05");
	});

	it("prefixes yesterday's messages", () => {
		expect(format(new Date(2026, 9, 13, 22, 15))).toBe("Yesterday at 10:15 PM");
		expect(format(new Date(2026, 9, 13, 22, 15), NOW, "de-DE")).toBe(
			"Yesterday at 22:15",
		);
	});

	it("uses the locale's short date and time for older messages", () => {
		const value = new Date(2026, 9, 12, 9, 41);
		expect(format(value)).toBe("10/12/26, 9:41 AM");
		expect(format(value, NOW, "de-DE")).toBe("12.10.26, 09:41");
	});

	it("includes the year for messages from earlier years", () => {
		expect(format(new Date(2025, 2, 3, 18, 30), NOW, "de-DE")).toBe(
			"03.03.25, 18:30",
		);
	});

	it("treats midnight as the start of the new day", () => {
		const midnight = new Date(2026, 9, 14, 0, 0);
		expect(format(midnight)).toBe("12:00 AM");
		expect(format(new Date(2026, 9, 13, 23, 59))).toBe("Yesterday at 11:59 PM");
	});

	it("rolls over when the reference time crosses midnight", () => {
		const message = new Date(2026, 9, 13, 23, 59);
		expect(format(message, new Date(2026, 9, 13, 23, 59, 59))).toBe("11:59 PM");
		expect(format(message, new Date(2026, 9, 14, 0, 0))).toBe(
			"Yesterday at 11:59 PM",
		);
		expect(format(message, new Date(2026, 9, 15, 0, 0))).toBe(
			"10/13/26, 11:59 PM",
		);
	});

	it("keeps the yesterday boundary at 00:00 two days back", () => {
		expect(format(new Date(2026, 9, 13, 0, 0))).toBe("Yesterday at 12:00 AM");
		expect(format(new Date(2026, 9, 12, 23, 59))).toBe("10/12/26, 11:59 PM");
	});

	it("counts calendar days across a daylight saving change", () => {
		const now = new Date(2026, 2, 30, 0, 30);
		expect(format(new Date(2026, 2, 29, 23, 30), now)).toBe(
			"Yesterday at 11:30 PM",
		);
		expect(format(new Date(2026, 2, 28, 23, 30), now)).toBe(
			"3/28/26, 11:30 PM",
		);
	});

	it("shows the full date for messages dated after today", () => {
		expect(format(new Date(2026, 9, 15, 9, 0))).toBe("10/15/26, 9:00 AM");
	});

	it("returns an empty string for invalid input", () => {
		expect(formatMessageTime("nope", NOW, "en-US")).toBe("");
	});
});
