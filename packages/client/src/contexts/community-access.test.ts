import { describe, expect, it } from "vitest";
import { communityAccessCode } from "./community-access";

describe("communityAccessCode", () => {
	it("lets a member through", () => {
		expect(communityAccessCode({ isMember: true })).toBeUndefined();
		expect(
			communityAccessCode({ isMember: true, isBanned: false }),
		).toBeUndefined();
	});

	it("reports a ban ahead of anything else", () => {
		expect(communityAccessCode({ isMember: false, isBanned: true })).toBe(
			"Banned",
		);
		expect(communityAccessCode({ isMember: true, isBanned: true })).toBe(
			"Banned",
		);
	});

	it("reports a non-member who is not banned", () => {
		expect(communityAccessCode({ isMember: false })).toBe("NotAMember");
	});
});
