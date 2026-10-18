import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { createDataStore } from "./store";
import type { Did, MemberView } from "./types";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const setup = async () => {
	setLatency(0);
	const source = createMockSource({ live: false });
	let listed = 0;
	const listCommunities = source.listCommunities;
	source.listCommunities = () => {
		listed += 1;
		return listCommunities();
	};
	const store = createDataStore(source);
	await until(() => !!store.communities.value()?.length);
	const community = store.spaceByKey(HQ);
	if (!community) throw new Error("Seed changed");
	const space = store.space(community);
	await until(() => !!space.members.value());
	return { source, store, space, listed: () => listed };
};

describe("member live events", () => {
	it("adds a member who joins and removes one who leaves", async () => {
		const { source, space } = await setup();
		const did = "did:plc:newcomer" as Did;
		const member = {
			actor: { did, handle: "newcomer.test" },
			roles: [],
			joinedAt: new Date().toISOString(),
		} as unknown as MemberView;
		source.emit({ $type: "memberJoinEvent", community: HQ, member });
		expect(
			space.members.value()?.some((entry) => entry.actor.did === did),
		).toBe(true);
		source.emit({ $type: "memberLeaveEvent", community: HQ, subject: did });
		expect(
			space.members.value()?.some((entry) => entry.actor.did === did),
		).toBe(false);
	});

	it("refreshes the Space list when the viewer joins elsewhere", async () => {
		const { source, store, listed } = await setup();
		const before = listed();
		source.emit({
			$type: "memberJoinEvent",
			community: HQ,
			member: {
				actor: { did: store.viewer.did },
				roles: [],
				joinedAt: new Date().toISOString(),
			} as unknown as MemberView,
		});
		await until(() => listed() > before);
	});

	it("drops the Space when the viewer leaves elsewhere", async () => {
		const { source, store } = await setup();
		source.emit({
			$type: "memberLeaveEvent",
			community: HQ,
			subject: store.viewer.did as Did,
		});
		expect(store.spaceByKey(HQ)).toBeUndefined();
	});
});
