import { describe, expect, it } from "vitest";
import { asDatetime, asDid, asHandle, asUri } from "../atproto/lexicons";
import { profileViewOf } from "./profile-view";
import type { LoggedInUser } from "./User";

const loggedInUser = (): LoggedInUser =>
	({
		loggedIn: true,
		did: asDid("did:plc:t4ckug4y36pkmxo5ej75v3ug"),
		handle: asHandle("lou.test"),
		displayName: "Lou",
		avatar: asUri("https://example.test/avatar"),
		isBot: false,
		syncBluesky: false,
		presence: { onlineState: "online" },
		communities: [],
		atproto: {
			client: { restore: () => undefined },
			agent: { did: "did:plc:t4ckug4y36pkmxo5ej75v3ug" },
			pdsHost: "https://pds.test",
		},
		xrpc: { call: () => undefined },
		refetchCommunities: async () => undefined,
		refetchProfile: async () => undefined,
		updateProfile: () => undefined,
		createdAt: asDatetime("2026-08-24T00:00:00.000Z"),
	}) as unknown as LoggedInUser;

describe("profileViewOf", () => {
	it("survives a trip through structured clone, which the offline cache needs", () => {
		const user = loggedInUser();

		expect(() => structuredClone(user)).toThrow();
		expect(structuredClone(profileViewOf(user))).toEqual(profileViewOf(user));
	});

	it("carries the profile across and leaves the session behind", () => {
		const profile = profileViewOf(loggedInUser());

		expect(profile.handle).toBe("lou.test");
		expect(profile.presence?.onlineState).toBe("online");
		expect(Object.keys(profile)).not.toContain("xrpc");
		expect(Object.keys(profile)).not.toContain("atproto");
		expect(Object.keys(profile)).not.toContain("refetchProfile");
	});
});
