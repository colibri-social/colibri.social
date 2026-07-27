import { describe, expect, it } from "vitest";
import { formatMessageTimestamp, formatTimestamp } from "./format-timestamp";

const NOW = new Date("2026-07-26T12:00:00.000Z");

const relative = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
	new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		value,
		unit,
	);

const at = (offsetMs: number) =>
	new Date(NOW.getTime() + offsetMs).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatTimestamp", () => {
	it("returns the input verbatim when it is not a valid date", () => {
		expect(formatTimestamp("not a date", "relative", NOW)).toBe("not a date");
	});

	it("returns the input verbatim for an invalid date in an absolute style", () => {
		expect(formatTimestamp("nope", "date-long", NOW)).toBe("nope");
	});

	it("defaults to the relative style", () => {
		expect(formatTimestamp(at(-30 * SECOND), undefined, NOW)).toBe(
			formatTimestamp(at(-30 * SECOND), "relative", NOW),
		);
	});

	it("uses seconds below a minute", () => {
		expect(formatTimestamp(at(-30 * SECOND), "relative", NOW)).toBe(
			relative(-30, "second"),
		);
	});

	it("switches to minutes at the minute boundary", () => {
		expect(formatTimestamp(at(-2 * MINUTE), "relative", NOW)).toBe(
			relative(-2, "minute"),
		);
	});

	it("rounds a half-unit duration toward zero for negative offsets", () => {
		expect(formatTimestamp(at(-90 * SECOND), "relative", NOW)).toBe(
			relative(-1, "minute"),
		);
	});

	it("switches to hours past sixty minutes", () => {
		expect(formatTimestamp(at(-3 * HOUR), "relative", NOW)).toBe(
			relative(-3, "hour"),
		);
	});

	it("switches to days past twenty-four hours", () => {
		expect(formatTimestamp(at(-3 * DAY), "relative", NOW)).toBe(
			relative(-3, "day"),
		);
	});

	it("handles future timestamps", () => {
		expect(formatTimestamp(at(2 * HOUR), "relative", NOW)).toBe(
			relative(2, "hour"),
		);
	});

	it("reaches years for very old timestamps", () => {
		expect(formatTimestamp(at(-800 * DAY), "relative", NOW)).toBe(
			relative(-2, "year"),
		);
	});

	it("produces distinct output for each absolute style", () => {
		const iso = at(0);
		const styles = [
			"time-short",
			"time-long",
			"date-short",
			"date-long",
			"datetime-short",
			"datetime-long",
		] as const;

		for (const style of styles) {
			expect(formatTimestamp(iso, style, NOW).length).toBeGreaterThan(0);
		}

		expect(formatTimestamp(iso, "time-long", NOW).length).toBeGreaterThan(
			formatTimestamp(iso, "time-short", NOW).length,
		);
	});

	it("ignores the now argument for absolute styles", () => {
		const iso = at(0);
		expect(formatTimestamp(iso, "date-short", NOW)).toBe(
			formatTimestamp(iso, "date-short", new Date("2020-01-01T00:00:00.000Z")),
		);
	});
});

describe("formatMessageTimestamp", () => {
	it("returns the input verbatim when it is not a valid date", () => {
		expect(formatMessageTimestamp("nope", NOW)).toBe("nope");
	});

	it("shows only the time within the last day", () => {
		const iso = at(-2 * HOUR);
		expect(formatMessageTimestamp(iso, NOW)).toBe(
			formatTimestamp(iso, "time-short", NOW),
		);
	});

	it("shows date and time once older than a day", () => {
		const iso = at(-2 * DAY);
		expect(formatMessageTimestamp(iso, NOW)).toBe(
			formatTimestamp(iso, "datetime-short", NOW),
		);
	});

	it("treats the threshold as exclusive", () => {
		const iso = at(-DAY);
		expect(formatMessageTimestamp(iso, NOW)).toBe(
			formatTimestamp(iso, "datetime-short", NOW),
		);
	});

	it("applies the same window to future timestamps", () => {
		const iso = at(2 * HOUR);
		expect(formatMessageTimestamp(iso, NOW)).toBe(
			formatTimestamp(iso, "time-short", NOW),
		);
	});
});
