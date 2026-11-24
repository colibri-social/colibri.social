import { describe, expect, it } from "vitest";
import type { MemberView, ProfileView } from "../types";
import { summaryAuthor } from "./display-name";

const community = {
	did: "did:plc:hq",
	handle: "hq.test",
	displayName: "The Space",
	avatar: "https://cdn.test/hq.webp",
} as unknown as ProfileView;

const bridged = {
	...community,
	displayName: "Alice Elsewhere",
	avatar: "https://cdn.test/alice.webp",
	bridge: { registration: "3lkbridge", platform: "matrix", remoteId: "a" },
} as unknown as ProfileView;

const member = {
	actor: {
		did: "did:plc:member",
		handle: "member.test",
		displayName: "Robin",
		avatar: "https://cdn.test/robin.webp",
	},
	nickname: "Rob",
	roles: [],
} as unknown as MemberView;

describe("summaryAuthor", () => {
	it("names a bridged author from their profile over a member entry", () => {
		expect(summaryAuthor(bridged, member)).toEqual({
			name: "Alice Elsewhere",
			avatarSrc: "https://cdn.test/alice.webp",
		});
	});

	it("names a member with their nickname", () => {
		expect(summaryAuthor(undefined, member)).toEqual({
			name: "Rob",
			avatarSrc: "https://cdn.test/robin.webp",
		});
	});

	it("prefers the member entry over a plain served profile", () => {
		expect(summaryAuthor(community, member).name).toBe("Rob");
	});

	it("names a non-member from a plain served profile", () => {
		expect(summaryAuthor(community, undefined).name).toBe("The Space");
	});

	it("names an unknown author Someone", () => {
		expect(summaryAuthor(undefined, undefined)).toEqual({ name: "Someone" });
	});
});
