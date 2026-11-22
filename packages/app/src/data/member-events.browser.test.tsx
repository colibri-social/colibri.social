import { describe, expect, it } from "vitest";
import { isVoiceChannel } from "./ids";
import { createMockSource, setLatency } from "./mock/source";
import type { DataSource } from "./source";
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

const newcomer = (did: Did) =>
	({
		actor: { did, handle: "newcomer.test", displayName: "Newcomer" },
		roles: [],
		joinedAt: new Date().toISOString(),
	}) as unknown as MemberView;

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

	it("replaces a member's profile, roles and nickname on update", async () => {
		const { source, space } = await setup();
		const current = space.members.value()?.[0];
		if (!current) throw new Error("Seed changed");
		const member = {
			...current,
			actor: {
				...current.actor,
				displayName: "Renamed",
				pronouns: "they/them",
				banner: "https://example.test/banner.webp",
			},
			nickname: "Nick",
		} as MemberView;
		source.emit({ $type: "memberUpdateEvent", community: HQ, member });
		const updated = space.members
			.value()
			?.find((entry) => entry.actor.did === current.actor.did);
		expect(updated?.actor.displayName).toBe("Renamed");
		expect(updated?.actor.pronouns).toBe("they/them");
		expect(updated?.actor.banner).toBe("https://example.test/banner.webp");
		expect(updated?.nickname).toBe("Nick");
	});

	it("refreshes the viewer when the update is about the viewer", async () => {
		const { source, store } = await setup();
		source.emit({
			$type: "memberUpdateEvent",
			community: HQ,
			member: {
				actor: {
					...store.viewer,
					displayName: "New name",
					avatar: "https://example.test/avatar.webp",
				},
				roles: [],
				joinedAt: new Date().toISOString(),
			} as unknown as MemberView,
		});
		expect(store.viewer.displayName).toBe("New name");
		expect(store.viewer.avatar).toBe("https://example.test/avatar.webp");
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

	it("keeps a join and a leave that land while the member list is loading", async () => {
		setLatency(0);
		const source = createMockSource({ live: false });
		const listMembers = source.listMembers;
		const held: Array<() => void> = [];
		source.listMembers = ((...args: Parameters<DataSource["listMembers"]>) =>
			new Promise((resolve) => {
				held.push(() => resolve(listMembers(...args)));
			})) as DataSource["listMembers"];
		const store = createDataStore(source);
		await until(() => !!store.communities.value()?.length);
		const community = store.spaceByKey(HQ);
		if (!community) throw new Error("Seed changed");
		const space = store.space(community);
		space.members.value();
		await until(() => held.length > 0);
		const seeded = await new Promise<MemberView[]>((resolve) => {
			listMembers(HQ, { limit: 100 }).then((page) => resolve(page.items));
		});
		const leaving = seeded[seeded.length - 1]?.actor.did;
		if (!leaving) throw new Error("Seed changed");
		const did = "did:plc:midfetch" as Did;
		source.emit({
			$type: "memberJoinEvent",
			community: HQ,
			member: newcomer(did),
		});
		source.emit({ $type: "memberLeaveEvent", community: HQ, subject: leaving });
		while (held.length > 0) held.shift()?.();
		await until(() => !!space.members.value());
		const dids = space.members.value()?.map((entry) => entry.actor.did);
		expect(dids).toContain(did);
		expect(dids).not.toContain(leaving);
		store.dispose();
	});

	it("adds a member whose update arrives before the join", async () => {
		const { source, space } = await setup();
		const did = "did:plc:updatedfirst" as Did;
		source.emit({
			$type: "memberUpdateEvent",
			community: HQ,
			member: newcomer(did),
		});
		expect(space.memberByDid(did)?.actor.handle).toBe("newcomer.test");
	});

	it("names a typing member once their join lands", async () => {
		const { source, store, space } = await setup();
		await until(() => !!space.channels.value()?.length);
		const text = space.channels
			.value()
			?.find((entry) => !isVoiceChannel(entry));
		if (!text) throw new Error("Seed changed");
		const feed = store.channel(text.space);
		await until(() => feed.ready());
		const did = "did:plc:typingnewcomer" as Did;
		source.emit({ $type: "typingEvent", did, channel: text.space });
		expect(feed.typing()).toContain(did);
		expect(space.memberByDid(did)).toBeUndefined();
		source.emit({
			$type: "memberJoinEvent",
			community: HQ,
			member: newcomer(did),
		});
		expect(feed.typing()).toContain(did);
		expect(space.memberByDid(did)?.actor.displayName).toBe("Newcomer");
	});
});
