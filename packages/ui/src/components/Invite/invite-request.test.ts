import { describe, expect, it } from "vitest";
import { inviteRequestFrom } from "./invite-settings";

const now = new Date("2026-10-08T12:00:00.000Z");

describe("inviteRequestFrom", () => {
	it("leaves both fields out for a link that never expires and has no limit", () => {
		expect(
			inviteRequestFrom({ expiry: "never", maxUses: "unlimited" }, now),
		).toEqual({});
	});

	it("turns the expiry into an absolute datetime", () => {
		expect(
			inviteRequestFrom({ expiry: "30m", maxUses: "unlimited" }, now),
		).toEqual({
			expiresAt: "2026-10-08T12:30:00.000Z",
		});
		expect(
			inviteRequestFrom({ expiry: "7d", maxUses: "unlimited" }, now),
		).toEqual({
			expiresAt: "2026-10-15T12:00:00.000Z",
		});
	});

	it("sends max uses as a number", () => {
		expect(inviteRequestFrom({ expiry: "never", maxUses: "25" }, now)).toEqual({
			maxUses: 25,
		});
	});
});
