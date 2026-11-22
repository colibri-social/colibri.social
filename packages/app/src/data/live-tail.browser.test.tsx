import { nextTid } from "@colibri-social/lib";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { channelSlug, isVoiceChannel } from "./ids";
import type { CachedWindow, MessageCache } from "./message-cache";
import { createMockSource, setLatency } from "./mock/source";
import type { DataSource, LiveEvent } from "./source";
import { createDataStore } from "./store";
import type { Did, MessageView, SpaceRef } from "./types";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const memoryCache = (): MessageCache => {
	const windows = new Map<SpaceRef, CachedWindow>();
	return {
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
};

const setup = async (options: { cache?: MessageCache } = {}) => {
	setLatency(0);
	const base = createMockSource({ live: false });
	const listeners = new Set<(event: LiveEvent) => void>();
	const requests: { method: string; channel?: string; painted?: boolean }[] =
		[];
	let painted = () => false;
	let down = false;
	let stalled: Promise<void> | undefined;
	let unreadLoads = 0;
	const source: DataSource = {
		...base,
		subscribe: (listener) => {
			const forward = (event: LiveEvent) => {
				if (!down) listener(event);
			};
			listeners.add(forward);
			const stop = base.subscribe(forward);
			return () => {
				listeners.delete(forward);
				stop();
			};
		},
		listMessages: async (params) => {
			requests.push({
				method: "listMessages",
				channel: params.channel,
				painted: painted(),
			});
			if (stalled) await stalled;
			return base.listMessages(params);
		},
		listUnreadStatus: (community) => {
			requests.push({ method: "listUnreadStatus" });
			return base.listUnreadStatus(community).then((statuses) => {
				unreadLoads += 1;
				return statuses;
			});
		},
	};
	const [epoch, setEpoch] = createSignal<number | undefined>(1);
	const store = createDataStore(source, {
		live: { epoch },
		...(options.cache ? { cache: options.cache } : {}),
	});
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq."));
	if (!hq) throw new Error("hq missing");
	const space = store.space(hq);
	await until(() => !!space.channels.value() && unreadLoads > 0);
	const text = (space.channels.value() ?? []).filter(
		(channel) => !isVoiceChannel(channel),
	);
	const author = base.world.spaces
		.find((entry) => entry.did === hq.did)
		?.members.find((member) => member.actor.did !== base.world.viewerDid)?.actor
		.did as Did;
	const say = (channel: SpaceRef, text: string) =>
		base.simulateMessage({ author, channel, text });
	const requestsFor = (channel: SpaceRef) =>
		requests.filter((entry) => entry.channel === channel).length;
	return {
		base,
		store,
		hq,
		space,
		text,
		say,
		requests,
		requestsFor,
		setEpoch,
		emit: (event: LiveEvent) => {
			for (const listener of listeners) listener(event);
		},
		watchPaint: (check: () => boolean) => {
			painted = check;
		},
		setDown: (next: boolean) => {
			down = next;
		},
		stallNetwork: () => {
			let release: () => void = () => {};
			stalled = new Promise<void>((resolve) => {
				release = resolve;
			});
			return () => {
				stalled = undefined;
				release();
			};
		},
	};
};

const rkeysOf = (list: readonly MessageView[]) =>
	list.map((message) => message.rkey);

describe("channel previews", () => {
	it("ignores a live message dated more than 15 minutes ahead", async () => {
		const { store, text, say, emit } = await setup();
		const target = text.find((channel) => channelSlug(channel) === "general");
		if (!target) throw new Error("general missing");
		const ref = target.space as SpaceRef;
		const arrived = say(ref, "On time");
		await until(() => store.lastMessage(ref)?.rkey === arrived.rkey);
		const ahead = Date.now() + 20 * 60 * 1000;
		emit({
			$type: "messageEvent",
			event: "create",
			channel: ref,
			message: {
				...arrived,
				rkey: nextTid(),
				text: "From the future",
				createdAt: new Date(ahead).toISOString() as MessageView["createdAt"],
			},
		} as LiveEvent);
		await wait(50);
		expect(store.lastMessage(ref)?.rkey).toBe(arrived.rkey);
		store.dispose();
	});
});

describe("live tail opens", () => {
	it("paints a never-opened channel from the tail with zero requests", async () => {
		const { base, store, space, text, say, requests, requestsFor } =
			await setup();
		const target = text.find((channel) => channelSlug(channel) === "general");
		if (!target) throw new Error("general missing");
		const ref = target.space as SpaceRef;
		await base.markRead(ref);
		await store.catchUp();
		await until(() => !!store.lastMessage(ref));
		await wait(50);
		const previous = store.lastMessage(ref)?.rkey;
		const arrived = say(ref, "Straight from the socket");
		expect(space.unread(channelSlug(target)).hasUnread).toBe(true);
		const before = requests.length;
		const feed = store.channel(ref);
		expect(feed.ready()).toBe(true);
		expect(feed.confirmed()).toBe(true);
		expect(feed.messages().at(-1)?.rkey).toBe(arrived.rkey);
		expect(requests.length).toBe(before);
		expect(feed.enter(true)).toBe(arrived.rkey);
		expect(feed.unreadAfter()).toBe(previous);
		const release = store.holdChannel(ref);
		await wait(100);
		expect(requestsFor(ref)).toBe(0);
		release();
		store.dispose();
	});

	it("hands an evicted window to the tail and reopens it without a request", async () => {
		const { store, text, say, requestsFor } = await setup();
		const [first, ...others] = text;
		if (!first || others.length < 8) throw new Error("not enough channels");
		const ref = first.space as SpaceRef;
		const feed = store.channel(ref);
		await until(() => feed.confirmed());
		feed.markRead();
		feed.enter(true);
		for (const other of others.slice(0, 8)) {
			const next = store.channel(other.space as SpaceRef);
			await until(() => next.ready());
			next.enter(true);
		}
		expect(feed.ready()).toBe(false);
		const opened = requestsFor(ref);
		const arrived = say(ref, "While you were in other channels");
		const reopened = store.channel(ref);
		expect(reopened).toBe(feed);
		expect(feed.ready()).toBe(true);
		expect(feed.confirmed()).toBe(true);
		expect(feed.messages().at(-1)?.rkey).toBe(arrived.rkey);
		expect(requestsFor(ref)).toBe(opened);
		store.dispose();
	});

	it("paints the tail after a reconnect, then fills the gap from the network", async () => {
		const { store, text, say, requests, setEpoch, setDown, watchPaint } =
			await setup();
		const [first, ...others] = text;
		if (!first || others.length < 8) throw new Error("not enough channels");
		const ref = first.space as SpaceRef;
		const feed = store.channel(ref);
		await until(() => feed.confirmed());
		feed.markRead();
		feed.enter(true);
		for (const other of others.slice(0, 8)) {
			const next = store.channel(other.space as SpaceRef);
			await until(() => next.ready());
			next.enter(true);
		}
		expect(feed.ready()).toBe(false);
		setDown(true);
		setEpoch(undefined);
		const missed = say(ref, "Sent while the socket was down");
		setDown(false);
		setEpoch(2);
		const arrived = say(ref, "Sent after the reconnect");
		const opened = requests.length;
		watchPaint(() => feed.ready());
		store.channel(ref);
		expect(feed.ready()).toBe(true);
		expect(feed.confirmed()).toBe(false);
		expect(rkeysOf(feed.messages())).not.toContain(missed.rkey);
		expect(feed.messages().at(-1)?.rkey).toBe(arrived.rkey);
		const refreshes = requests
			.slice(opened)
			.filter((entry) => entry.channel === ref);
		expect(refreshes.length).toBeGreaterThan(0);
		expect(refreshes.every((entry) => entry.painted)).toBe(true);
		await until(() => feed.confirmed());
		const keys = rkeysOf(feed.messages());
		expect(keys).toContain(missed.rkey);
		expect(keys.at(-1)).toBe(arrived.rkey);
		store.dispose();
	});

	it("shows a tapped notification's message from the tail while the network is slow", async () => {
		const cache = memoryCache();
		const { base, store, text, say, setEpoch, stallNetwork } = await setup({
			cache,
		});
		const target = text.find((channel) => channelSlug(channel) === "general");
		if (!target) throw new Error("general missing");
		const ref = target.space as SpaceRef;
		const page = await base.listMessages({ channel: ref, limit: 20 });
		cache.offer(
			ref,
			[...page.items].sort((a, b) => a.rkey.localeCompare(b.rkey)),
			{ cursor: page.cursor, hasMore: !!page.cursor },
		);
		setEpoch(undefined);
		setEpoch(2);
		const pinged = say(ref, "The message that pinged you");
		const release = stallNetwork();
		store.jumps.request({ channel: ref, rkey: pinged.rkey });
		const feed = store.channel(ref);
		await until(() => feed.ready());
		expect(rkeysOf(feed.messages())).toContain(pinged.rkey);
		release();
		await until(() => feed.confirmed());
		expect(rkeysOf(feed.messages())).toContain(pinged.rkey);
		store.dispose();
	});

	it("puts a notified message into a channel whose message event never arrived", async () => {
		const { base, store, hq, text, say, setDown, stallNetwork } = await setup();
		const target = text.find((channel) => channelSlug(channel) === "general");
		if (!target) throw new Error("general missing");
		const ref = target.space as SpaceRef;
		await base.markRead(ref);
		await store.catchUp();
		await until(() => !!store.lastMessage(ref));
		await wait(50);
		setDown(true);
		const pinged = say(ref, "Only the notification made it");
		setDown(false);
		base.emit({
			$type: "notificationEvent",
			notification: {
				id: "notification-1",
				kind: "message",
				author: pinged.author,
				channel: ref,
				community: hq.did,
				message: pinged,
				indexedAt: pinged.createdAt,
			},
		} as LiveEvent);
		const release = stallNetwork();
		store.jumps.request({ channel: ref, rkey: pinged.rkey });
		const feed = store.channel(ref);
		await until(() => feed.ready());
		expect(rkeysOf(feed.messages())).toContain(pinged.rkey);
		release();
		store.dispose();
	});

	it("forgets tails when the Space goes away", async () => {
		const { base, store, hq, text, say, requestsFor } = await setup();
		const target = text[0];
		if (!target) throw new Error("channel missing");
		const ref = target.space as SpaceRef;
		await base.markRead(ref);
		await store.catchUp();
		await wait(50);
		say(ref, "About to vanish");
		base.emit({ $type: "communityRemovedEvent", community: hq.did });
		const feed = store.channel(ref);
		expect(feed.ready()).toBe(false);
		await until(() => requestsFor(ref) > 0);
		store.dispose();
	});
});
