import { describe, expect, it } from "vitest";
import type { RoleView } from "../../../data/types";
import {
	deleteDescription,
	draftOf,
	formOf,
	roleNameError,
	rolePatch,
} from "./role-form";

describe("role form", () => {
	it("only sends what changed", () => {
		const base = formOf({
			rkey: "mods",
			name: "Moderators",
			color: "#7ee0a1",
			position: 2,
			permissions: ["member.kick"],
			badge: {
				$type: "social.colibri.beta.community.defs#roleIconBadge",
				icon: "shield-check",
			},
		} as unknown as RoleView);
		expect(rolePatch(base, { ...base })).toEqual({});
		expect(
			rolePatch(base, {
				...base,
				name: " Mods ",
				color: undefined,
				badge: undefined,
				permissions: ["member.kick", "member.ban"],
			}),
		).toEqual({
			name: "Mods",
			color: "",
			removeBadge: true,
			permissions: ["member.kick", "member.ban"],
		});
		expect(
			rolePatch(base, {
				...base,
				badge: { kind: "icon", name: "crown", color: "#ffc861" },
			}),
		).toEqual({ badge: { icon: "crown", color: "#ffc861" } });
	});

	it("maps emoji badges both ways", () => {
		const uri =
			"at://did:plc:colibrihqspace2a4b6c8d/blue.moji.collection.item/lgtm";
		const unicode = formOf({
			rkey: "parrots",
			name: "Parrots",
			position: 2,
			permissions: [],
			badge: {
				$type: "social.colibri.beta.community.defs#roleEmojiBadgeView",
				emoji: "🦜",
			},
		} as unknown as RoleView);
		expect(unicode.badge).toEqual({ kind: "emoji", emoji: "🦜" });
		expect(rolePatch(unicode, { ...unicode })).toEqual({});
		expect(
			rolePatch(unicode, {
				...unicode,
				badge: {
					kind: "emoji",
					custom: {
						id: uri,
						name: "lgtm",
						src: "https://example.com/lgtm.png",
					},
				},
			}),
		).toEqual({ emojiBadge: { customEmoji: { uri } } });
		expect(
			draftOf({ ...unicode, badge: { kind: "emoji", emoji: "🎉" } }).emojiBadge,
		).toEqual({ emoji: "🎉" });

		const resolved = formOf({
			rkey: "lgtm",
			name: "LGTM",
			position: 2,
			permissions: [],
			badge: {
				$type: "social.colibri.beta.community.defs#roleEmojiBadgeView",
				customEmoji: { uri },
				name: "lgtm",
				image: "https://example.com/lgtm.png",
			},
		} as unknown as RoleView);
		expect(resolved.badge).toEqual({
			kind: "emoji",
			custom: { id: uri, name: "lgtm", src: "https://example.com/lgtm.png" },
		});

		const unresolved = formOf({
			rkey: "gone",
			name: "Gone",
			position: 2,
			permissions: [],
			badge: {
				$type: "social.colibri.beta.community.defs#roleEmojiBadgeView",
				customEmoji: { uri },
			},
		} as unknown as RoleView);
		expect(unresolved.badge).toBeUndefined();
	});

	it("validates names and words the delete prompt", () => {
		expect(roleNameError("  ")).toBe("Give the role a name.");
		expect(roleNameError("x".repeat(33))).toContain("at most 32");
		expect(roleNameError("Crew")).toBeUndefined();
		expect(deleteDescription(0)).toBe("This action cannot be undone.");
		expect(deleteDescription(1)).toBe(
			"This role will be removed from 1 member. This action cannot be undone.",
		);
	});
});
