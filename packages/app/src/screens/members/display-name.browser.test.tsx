import { describe, expect, it } from "vitest";
import { displayNameOf } from "../../data/adapters/authors";
import type { MemberView, ProfileView } from "../../data/types";
import { toListMember } from "./member-adapter";

const actor = (displayName: string | undefined) =>
	({
		did: "did:plc:macposter000000000000000" as MemberView["actor"]["did"],
		handle: "macposter.bsky.social" as const,
		...(displayName === undefined ? {} : { displayName }),
	}) as unknown as ProfileView;

const member = (
	displayName: string | undefined,
	nickname?: string,
): MemberView =>
	({ actor: actor(displayName), roles: [], nickname }) as unknown as MemberView;

describe("display name fallback", () => {
	it.each([
		["missing", undefined],
		["empty", ""],
		["whitespace", "   "],
	])("falls back to the handle when the name is %s", (_, name) => {
		expect(displayNameOf(actor(name))).toBe("macposter.bsky.social");
		expect(
			toListMember(member(name), {
				roleByKey: () => undefined,
				presence: undefined,
			}).name,
		).toBe("macposter.bsky.social");
	});

	it("prefers a nickname, then a trimmed name", () => {
		expect(displayNameOf(actor(" Mac "), { nickname: "  " })).toBe("Mac");
		expect(displayNameOf(actor("Mac"), { nickname: "Poster" })).toBe("Poster");
	});
});
