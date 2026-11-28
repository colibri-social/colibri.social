import { nextTid } from "@colibri-social/lib";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { channelSlug, isVoiceChannel } from "./ids";
import type { CachedWindow, MessageCache } from "./message-cache";
import { createMockSource, setLatency } from "./mock/source";
import { createDataStore } from "./store";
import type { Did, MessageView, SpaceRef } from "./types";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();

	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");

		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const memoryCache = () => {
	const windows = new Map<SpaceRef, CachedWindow>();

	const cache: MessageCache = {
		recall: (space) => windows.get(space),
		read: async (space) => windows.get(space),
		offer: (space, messages, options) => {
			windows.set(space, {
				space,
				messages: [...messages],
				...options,
				ts: Date.now(),
			});
		},
		forget: (space) => {
			windows.delete(space);
		},
		forgetCommunity: () => {},
		flush: async () => {},
		clear: async () => {
			windows.clear();
		},
	};

	return { cache, windows };
};

const rkeysOf = (list: readonly MessageView[]) => {
	return list.map((message) => message.rkey);
};

const setup = async () => {
	setLatency(0);

	const base = createMockSource({ live: false });
	const { cache, windows } = memoryCache();
	const [epoch] = createSignal<number | undefined>(1);

	const store = createDataStore(base, {
		live: { epoch },
		cache,
	});

	await until(() => !!store.communities.value());

	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq."));

	if (!hq) throw new Error("hq missing");

	const space = store.space(hq);

	await until(() => !!space.channels.value());

	const text = (space.channels.value() ?? []).filter(
		(channel) => !isVoiceChannel(channel),
	);

	const target = text.find((channel) => channelSlug(channel) === "general");

	if (!target) throw new Error("general missing");

	const author = base.world.spaces
		.find((entry) => entry.did === hq.did)
		?.members.find((member) => member.actor.did !== base.world.viewerDid)?.actor
		.did as Did;

	return {
		base,
		store,
		windows,
		ref: target.space as SpaceRef,
		author,
	};
};

describe("arrival order", () => {
	it("keeps a late arrival with an older TID below your confirmed send", async () => {
		const { base, store, windows, ref, author } = await setup();
		const feed = store.channel(ref);

		await until(() => feed.ready());

		const older = nextTid();

		await feed.send({ text: "Mine" });
		await until(() => feed.pending().length === 0);

		const mine = feed.messages().at(-1)?.rkey;

		expect(mine).toBeDefined();
		expect(older < (mine ?? "")).toBe(true);

		base.simulateMessage({ author, channel: ref, rkey: older, text: "Late" });
		await until(() => rkeysOf(feed.messages()).includes(older));

		expect(rkeysOf(feed.messages()).slice(-2)).toEqual([mine, older]);

		await feed.reload();
		await until(() => rkeysOf(feed.messages()).includes(older));

		expect(rkeysOf(feed.messages()).slice(-2)).toEqual([mine, older]);
		await until(() => !!windows.get(ref));
		expect(rkeysOf(windows.get(ref)?.messages ?? []).slice(-2)).toEqual([
			older,
			mine,
		]);
		store.dispose();
	});

	it("keeps rkey order for an older arrival without a send", async () => {
		const { base, store, ref, author } = await setup();
		const feed = store.channel(ref);

		await until(() => feed.ready());

		const older = nextTid();
		const newer = base.simulateMessage({ author, channel: ref, text: "First" });

		await until(() => rkeysOf(feed.messages()).includes(newer.rkey));
		base.simulateMessage({ author, channel: ref, rkey: older, text: "Late" });
		await until(() => rkeysOf(feed.messages()).includes(older));

		expect(rkeysOf(feed.messages()).slice(-2)).toEqual([older, newer.rkey]);
		store.dispose();
	});
});
