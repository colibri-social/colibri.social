import { afterEach, describe, expect, it } from "vitest";
import {
	cacheNamespace,
	clearDeviceCache,
	createMessageCache,
} from "./message-cache";
import { createMockSource, setLatency } from "./mock/source";
import type { LiveEvent } from "./source";
import { createDataStore } from "./store";
import type { MessageView, SpaceRef } from "./types";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const stores: { dispose: () => void }[] = [];
afterEach(async () => {
	for (const store of stores.splice(0)) store.dispose();
	await clearDeviceCache();
});

const createWorld = () => {
	setLatency(0);
	const base = createMockSource({ live: false });
	let away = false;
	const listCalls: { cursor?: string; limit?: number }[] = [];
	const source = {
		...base,
		subscribe: (listener: (event: LiveEvent) => void) =>
			base.subscribe((event) => {
				if (!away) listener(event);
			}),
		listMessages: (params: Parameters<typeof base.listMessages>[0]) => {
			listCalls.push({ cursor: params.cursor, limit: params.limit });
			return base.listMessages(params);
		},
	};
	const open = async (cache: ReturnType<typeof createMessageCache>) => {
		const store = createDataStore(source, { cache });
		stores.push(store);
		await until(() => !!store.communities.value());
		const hq = store.communities
			.value()
			?.find((entry) => entry.handle.startsWith("hq."));
		if (!hq) throw new Error("hq missing");
		const space = store.space(hq);
		await until(() => !!space.channels.value());
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		return { store, general: general.space };
	};
	return {
		base,
		source,
		open,
		listCalls,
		setAway: (value: boolean) => {
			away = value;
		},
	};
};

const rkeys = (list: readonly MessageView[]) => list.map((entry) => entry.rkey);

describe("message cache", () => {
	it("reopens a seen channel straight from memory without waiting for the network", async () => {
		const world = createWorld();
		const cache = createMessageCache({ namespace: "test", kv: null });
		const first = await world.open(cache);
		const feed = first.store.channel(first.general);
		await until(() => feed.ready());
		const seen = rkeys(feed.messages());
		first.store.dispose();

		const second = await world.open(cache);
		const reopened = second.store.channel(second.general);
		expect(reopened.ready()).toBe(true);
		expect(rkeys(reopened.messages())).toEqual(seen.slice(-50));
		expect(reopened.hasOlder()).toBe(true);
	});

	it("merges newer messages and drops deletes from one newest page", async () => {
		const world = createWorld();
		const cache = createMessageCache({ namespace: "test", kv: null });
		const first = await world.open(cache);
		const feed = first.store.channel(first.general);
		await until(() => feed.ready());
		const cached = feed.messages();
		const victim = cached.at(-2);
		const author = cached.find(
			(entry) => entry.author.did !== first.store.viewer.did,
		)?.author;
		if (!victim || !author) throw new Error("fixtures missing");
		first.store.dispose();

		world.setAway(true);
		await world.base.deleteMessage({
			channel: first.general,
			rkey: victim.rkey,
		});
		const fresh = world.base.simulateMessage({
			author: author.did,
			channel: first.general,
			text: "arrived while away",
		});
		world.setAway(false);
		world.listCalls.length = 0;

		const second = await world.open(cache);
		const reopened = second.store.channel(second.general);
		expect(reopened.ready()).toBe(true);
		const painted = rkeys(reopened.messages());
		expect(painted).toContain(victim.rkey);
		await until(() => rkeys(reopened.messages()).includes(fresh.rkey));
		const refreshed = rkeys(reopened.messages());
		expect(refreshed).not.toContain(victim.rkey);
		expect(refreshed).toEqual([...refreshed].sort());
		expect(
			painted.filter(
				(rkey) => rkey !== victim.rkey && refreshed.includes(rkey),
			),
		).toEqual(refreshed.filter((rkey) => painted.includes(rkey)));
		expect(world.listCalls).toHaveLength(1);
		expect(world.listCalls[0]?.cursor).toBeUndefined();
	});

	it("restores a channel after a restart from the device snapshot", async () => {
		const world = createWorld();
		const namespace = cacheNamespace("did:web:appview", "did:plc:viewer");
		const before = createMessageCache({ namespace });
		const first = await world.open(before);
		const feed = first.store.channel(first.general);
		await until(() => feed.ready());
		const seen = rkeys(feed.messages());
		await before.flush();
		first.store.dispose();

		const after = createMessageCache({ namespace });
		const stored = await after.read(first.general as SpaceRef);
		expect(stored && rkeys(stored.messages)).toEqual(seen.slice(-50));

		const second = await world.open(after);
		const reopened = second.store.channel(second.general);
		await until(() => reopened.ready());
		expect(rkeys(reopened.messages()).slice(-stored!.messages.length)).toEqual(
			rkeys(stored!.messages),
		);
	});

	it("forgets everything on sign-out and on an account switch", async () => {
		const world = createWorld();
		const owner = cacheNamespace("did:web:appview", "did:plc:viewer");
		const cache = createMessageCache({ namespace: owner });
		const first = await world.open(cache);
		const feed = first.store.channel(first.general);
		await until(() => feed.ready());
		await cache.flush();

		const other = createMessageCache({
			namespace: cacheNamespace("did:web:appview", "did:plc:someone-else"),
		});
		expect(await other.read(first.general)).toBeUndefined();
		expect(
			await createMessageCache({ namespace: owner }).read(first.general),
		).toBeUndefined();

		const again = createMessageCache({ namespace: owner });
		again.offer(first.general, feed.messages(), { hasMore: false });
		await again.flush();
		await clearDeviceCache();
		expect(
			await createMessageCache({ namespace: owner }).read(first.general),
		).toBeUndefined();
	});

	it("keeps working when device storage stalls", async () => {
		const world = createWorld();
		const stalled = createMessageCache({
			namespace: "stalled",
			kv: {
				enabled: () => false,
				get: async () => undefined,
				values: async () => [],
				put: async () => undefined,
				remove: async () => undefined,
				removeWhere: async () => undefined,
				clear: async () => undefined,
				evictOldest: async () => undefined,
				close: () => undefined,
			},
		});
		const first = await world.open(stalled);
		const feed = first.store.channel(first.general);
		await until(() => feed.ready());
		expect(feed.messages().length).toBeGreaterThan(0);
	});
});
