import { describe, expect, it } from "vitest";
import {
	isAssignableRole,
	isDefaultRole,
	isMentionableRole,
} from "./role-flags";
import type { RoleView } from "./types";

const role = (extra: Partial<RoleView> & { default?: boolean } = {}) =>
	({
		rkey: "role",
		name: "Role",
		permissions: [],
		position: 1,
		...extra,
	}) as RoleView;

describe("role flags", () => {
	it("treats a missing default flag as false", () => {
		expect(isDefaultRole(role())).toBe(false);
		expect(isDefaultRole(role({ default: true }))).toBe(true);
	});

	it("never offers the default role as a mention, even when it claims to be mentionable", () => {
		expect(isMentionableRole(role({ mentionable: true }))).toBe(true);
		expect(isMentionableRole(role({ mentionable: true, default: true }))).toBe(
			false,
		);
		expect(
			isMentionableRole(role({ mentionable: true, protected: true })),
		).toBe(false);
	});

	it("keeps the default and owner roles out of the member role picker", () => {
		expect(isAssignableRole(role())).toBe(true);
		expect(isAssignableRole(role({ default: true }))).toBe(false);
		expect(isAssignableRole(role({ protected: true }))).toBe(false);
	});
});
