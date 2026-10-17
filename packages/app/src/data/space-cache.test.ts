import {
	createMemoryKvStore,
	type KvStore,
	SPACE_SNAPSHOT_TTL_MS,
} from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { createSpaceCache } from "./space-cache";
import type {
	ChannelView,
	CommunityView,
	ProfileView,
	ThreadView,
} from "./types";

const memoryKv = createMemoryKvStore;

const viewer = {
	did: "did:plc:viewer",
	handle: "lou.gg",
} as unknown as ProfileView;
const space = (did: string) =>
	({ did, name: did, memberCount: 1 }) as unknown as CommunityView;
const channel = (name: string) =>
	({ name, space: `at://did:plc:a/space/${name}` }) as unknown as ChannelView;
const thread = (name: string) => ({ name }) as unknown as ThreadView;

const fill = async (kv: KvStore, namespace = "app:did:plc:viewer") => {
	const cache = createSpaceCache({ namespace, kv });
	cache.offerViewer(viewer);
	cache.offerCommunities([space("did:plc:a"), space("did:plc:b")]);
	cache.offerSpace("did:plc:a", {
		channels: [channel("general")],
		categories: [],
		roles: [],
		unread: { general: { hasUnread: true, mentions: 2 } },
	});
	cache.offerThreads("did:plc:a", "at://did:plc:a/space/general", [
		thread("Spring tuning"),
	]);
	await cache.flush();
	return cache;
};

describe("space cache", () => {
	it("restores the last known Spaces on the next start", async () => {
		const kv = memoryKv();
		await fill(kv);
		const next = createSpaceCache({ namespace: "app:did:plc:viewer", kv });
		const snapshot = await next.load();
		expect(snapshot?.viewer?.handle).toBe("lou.gg");
		expect(snapshot?.communities?.map((entry) => entry.did)).toEqual([
			"did:plc:a",
			"did:plc:b",
		]);
		const entry = snapshot?.spaces["did:plc:a"];
		expect(entry?.channels?.[0]?.name).toBe("general");
		expect(entry?.unread?.general).toEqual({ hasUnread: true, mentions: 2 });
		expect(entry?.threads?.["at://did:plc:a/space/general"]?.[0]?.name).toBe(
			"Spring tuning",
		);
		expect(next.snapshot()).toBe(snapshot);
	});

	it("forgets a Space that was left and ignores later writes for it", async () => {
		const kv = memoryKv();
		const cache = await fill(kv);
		cache.forgetCommunity("did:plc:a");
		cache.offerSpace("did:plc:a", { channels: [channel("again")] });
		cache.offerCommunities([space("did:plc:a"), space("did:plc:b")]);
		await cache.flush();
		const snapshot = await createSpaceCache({
			namespace: "app:did:plc:viewer",
			kv,
		}).load();
		expect(snapshot?.spaces["did:plc:a"]).toBeUndefined();
		expect(snapshot?.communities?.map((entry) => entry.did)).toEqual([
			"did:plc:b",
		]);
		expect(cache.isGone("did:plc:a")).toBe(true);
	});

	it("drops cached structure for Spaces no longer in the list", async () => {
		const kv = memoryKv();
		const cache = await fill(kv);
		cache.offerCommunities([space("did:plc:b")]);
		await cache.flush();
		const snapshot = await createSpaceCache({
			namespace: "app:did:plc:viewer",
			kv,
		}).load();
		expect(snapshot?.spaces["did:plc:a"]).toBeUndefined();
	});

	it("never hands one account's Spaces to another", async () => {
		const kv = memoryKv();
		await fill(kv);
		const other = createSpaceCache({ namespace: "app:did:plc:other", kv });
		expect(await other.load()).toBeUndefined();
	});

	it("ignores a snapshot past its age limit", async () => {
		const kv = memoryKv();
		let time = 1_000;
		const cache = createSpaceCache({
			namespace: "app:did:plc:viewer",
			kv,
			now: () => time,
		});
		cache.offerViewer(viewer);
		cache.offerCommunities([space("did:plc:a")]);
		await cache.flush();
		time += SPACE_SNAPSHOT_TTL_MS + 1;
		const later = createSpaceCache({
			namespace: "app:did:plc:viewer",
			kv,
			now: () => time,
		});
		expect(await later.load()).toBeUndefined();
	});

	it("clears everything on sign-out", async () => {
		const kv = memoryKv();
		const cache = await fill(kv);
		await cache.clear();
		const snapshot = await createSpaceCache({
			namespace: "app:did:plc:viewer",
			kv,
		}).load();
		expect(snapshot).toBeUndefined();
	});

	it("works without device storage", async () => {
		const cache = createSpaceCache({ namespace: "x", kv: null });
		cache.offerViewer(viewer);
		await cache.flush();
		expect(await cache.load()).toBeUndefined();
	});
});
