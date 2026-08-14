import { describe, expect, it } from "vitest";
import { canAdvanceCursor, clearableNotifications } from "./deferred-mark-read";

const message = (rkey: string) =>
	`at://did:plc:one/social.colibri.message/${rkey}`;

describe("canAdvanceCursor", () => {
	it("allows the first cursor a channel ever gets", () => {
		expect(canAdvanceCursor(undefined, message("3lb"))).toBe(true);
	});

	it("allows moving on to a newer message", () => {
		expect(canAdvanceCursor(message("3la"), message("3lb"))).toBe(true);
	});

	it("refuses to rewind onto an older message", () => {
		expect(canAdvanceCursor(message("3lb"), message("3la"))).toBe(false);
	});

	it("refuses a cursor that would not move at all", () => {
		expect(canAdvanceCursor(message("3lb"), message("3lb"))).toBe(false);
	});

	it("compares the record key rather than the whole uri", () => {
		expect(
			canAdvanceCursor(
				"at://did:plc:zzz/social.colibri.message/3la",
				"at://did:plc:aaa/social.colibri.message/3lb",
			),
		).toBe(true);
	});
});

describe("clearableNotifications", () => {
	const notifications = [
		{ indexedAt: "2026-08-15T10:00:00.000Z", messageUri: "at://old" },
		{ indexedAt: "2026-08-15T12:00:00.000Z", messageUri: "at://new" },
	];

	it("clears everything when no cutoff is given", () => {
		expect(clearableNotifications(notifications, undefined)).toEqual(
			notifications,
		);
	});

	it("leaves alone anything indexed after the button was pressed", () => {
		const before = Date.parse("2026-08-15T11:00:00.000Z");

		expect(clearableNotifications(notifications, before)).toEqual([
			notifications[0],
		]);
	});

	it("clears a notification indexed at the very moment of the press", () => {
		const before = Date.parse("2026-08-15T10:00:00.000Z");

		expect(clearableNotifications(notifications, before)).toEqual([
			notifications[0],
		]);
	});

	it("clears nothing when the whole channel is newer than the press", () => {
		const before = Date.parse("2026-08-15T09:00:00.000Z");

		expect(clearableNotifications(notifications, before)).toEqual([]);
	});
});
