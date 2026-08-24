import { describe, expect, it } from "vitest";
import { clearableNotifications } from "./deferred-mark-read";

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
