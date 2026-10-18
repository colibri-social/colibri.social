import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { channelSlug } from "../ids";
import type { LiveEvent } from "../source";
import type { MessageView, SpaceRef } from "../types";
import { createMockSource, setLatency } from "./source";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const source = () => createMockSource({ now: NOW, live: false });

const checkFacets = (message: MessageView) => {
	const bytes = encoder.encode(message.text);
	for (const facet of message.facets ?? []) {
		const { byteStart, byteEnd } = facet.index;
		expect(byteStart).toBeGreaterThanOrEqual(0);
		expect(byteEnd).toBeGreaterThan(byteStart);
		expect(byteEnd).toBeLessThanOrEqual(bytes.length);
		expect(() => decoder.decode(bytes.slice(byteStart, byteEnd))).not.toThrow();
		expect(() => decoder.decode(bytes.slice(0, byteStart))).not.toThrow();
	}
	expect(bytes.length).toBeLessThanOrEqual(2048);
};

const allMessages = async (
	mock: ReturnType<typeof source>,
	channel: SpaceRef,
	max = Number.POSITIVE_INFINITY,
) => {
	const out: MessageView[] = [];
	let cursor: string | undefined;
	do {
		const page = await mock.listMessages({ channel, cursor, limit: 100 });
		out.push(...page.items);
		cursor = page.cursor;
	} while (cursor && out.length < max);
	return out;
};

const channelBySlug = async (
	mock: ReturnType<typeof source>,
	space: string,
	channel: string,
) => {
	const communities = await mock.listCommunities();
	const community = communities.find(
		(entry) => entry.handle.split(".")[0] === space,
	);
	if (!community) throw new Error(space);
	const channels = await mock.listChannels(community.did);
	const found = channels.find((entry) => channelSlug(entry) === channel);
	if (!found) throw new Error(channel);
	return { community, channel: found };
};

beforeEach(() => setLatency(0));
afterEach(() => setLatency(80, 260));

describe("mock source", () => {
	it("has three Spaces with unique slugs and the planned sizes", async () => {
		const mock = source();
		const communities = await mock.listCommunities();
		expect(communities.map((entry) => entry.handle.split(".")[0])).toEqual([
			"hq",
			"nightowls",
			"trailheads",
		]);
		expect(communities.map((entry) => entry.memberCount)).toEqual([
			60, 500, 25,
		]);
		for (const community of communities) {
			const channels = await mock.listChannels(community.did);
			const slugs = channels.map(channelSlug);
			expect(new Set(slugs).size).toBe(slugs.length);
			for (const slug of slugs) expect(slug).toMatch(/^[a-z-]+$/);
		}
	});

	it("gives every person a unique DID", () => {
		const mock = source();
		const dids = mock.world.people.all.map((person) => person.did);
		expect(new Set(dids).size).toBe(dids.length);
	});

	it("keeps every facet on UTF-8 character boundaries", async () => {
		const mock = source();
		for (const community of await mock.listCommunities()) {
			for (const channel of await mock.listChannels(community.did)) {
				const max =
					channelSlug(channel) === "archive" ? 500 : Number.POSITIVE_INFINITY;
				for (const message of await allMessages(mock, channel.space, max)) {
					checkFacets(message);
				}
				for (const thread of await mock.listThreads(channel.space)) {
					for (const message of await allMessages(mock, thread.space)) {
						checkFacets(message);
					}
				}
			}
		}
	});

	it("pages without duplicates in both directions", async () => {
		const mock = source();
		const { channel } = await channelBySlug(mock, "hq", "general");
		const newestFirst = await allMessages(mock, channel.space);
		const keys = newestFirst.map((message) => message.rkey);
		expect(new Set(keys).size).toBe(keys.length);
		expect([...keys].sort().reverse()).toEqual(keys);
		const oldestFirst: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await mock.listMessages({
				channel: channel.space,
				cursor,
				reverse: true,
				limit: 37,
			});
			oldestFirst.push(...page.items.map((message) => message.rkey));
			cursor = page.cursor;
		} while (cursor);
		expect(oldestFirst).toEqual([...keys].reverse());
	});

	it("holds 10,000 messages in the archive and none in the empty channel", async () => {
		const mock = source();
		const archive = await channelBySlug(mock, "nightowls", "archive");
		expect(await allMessages(mock, archive.channel.space)).toHaveLength(10_000);
		const empty = await channelBySlug(mock, "trailheads", "photos");
		expect(
			(await mock.listMessages({ channel: empty.channel.space })).items,
		).toEqual([]);
	});

	it("is deterministic", async () => {
		const first = source();
		const second = source();
		const a = await channelBySlug(first, "hq", "general");
		const b = await channelBySlug(second, "hq", "general");
		expect(await first.listMessages({ channel: a.channel.space })).toEqual(
			await second.listMessages({ channel: b.channel.space }),
		);
	});

	it("gives every thread between 4 and 30 messages", async () => {
		const mock = source();
		let threads = 0;
		for (const community of await mock.listCommunities()) {
			for (const channel of await mock.listChannels(community.did)) {
				for (const thread of await mock.listThreads(channel.space)) {
					threads++;
					const messages = await allMessages(mock, thread.space);
					expect(messages.length).toBeGreaterThanOrEqual(4);
					expect(messages.length).toBeLessThanOrEqual(30);
					expect(thread.messageCount).toBe(messages.length);
				}
			}
		}
		expect(threads).toBeGreaterThanOrEqual(3);
	});

	it("reports unread channels with a read cursor and mentions", async () => {
		const mock = source();
		const { community, channel } = await channelBySlug(mock, "hq", "general");
		const statuses = await mock.listUnreadStatus(community.did);
		const general = statuses.find((status) => status.channel === channel.space);
		expect(general?.hasUnread).toBe(true);
		expect(general?.cursor).toBeTruthy();
		expect(statuses.some((status) => status.unreadMentions > 0)).toBe(true);
	});

	it("emits events for every mutation", async () => {
		const mock = source();
		const events: LiveEvent[] = [];
		const stop = mock.subscribe((event) => events.push(event));
		const { channel } = await channelBySlug(mock, "hq", "general");
		const sent = await mock.sendMessage({
			channel: channel.space,
			text: "hello there",
		});
		await mock.editMessage({
			channel: channel.space,
			rkey: sent.rkey,
			text: "hello again",
		});
		await mock.react({
			channel: channel.space,
			rkey: sent.rkey,
			emoji: "👍",
			add: true,
		});
		await mock.react({
			channel: channel.space,
			rkey: sent.rkey,
			emoji: "👍",
			add: false,
		});
		await mock.deleteMessage({ channel: channel.space, rkey: sent.rkey });
		await mock.markRead(channel.space);
		stop();
		expect(
			events.map(
				(event) => `${event.$type}:${"event" in event ? event.event : ""}`,
			),
		).toEqual([
			"messageEvent:create",
			"messageEvent:update",
			"reactionEvent:create",
			"reactionEvent:delete",
			"messageEvent:delete",
			"seenEvent:",
		]);
	});

	it("sends into threads too", async () => {
		const mock = source();
		const { channel } = await channelBySlug(mock, "nightowls", "critique");
		const [thread] = await mock.listThreads(channel.space);
		if (!thread) throw new Error("no thread");
		const sent = await mock.sendMessage({
			channel: thread.space,
			text: "looks great",
		});
		const page = await mock.listMessages({ channel: thread.space, limit: 1 });
		expect(page.items[0]?.rkey).toBe(sent.rkey);
		await mock.react({
			channel: thread.space,
			rkey: sent.rkey,
			emoji: "🔥",
			add: true,
		});
	});

	it("updates controls in memory", () => {
		const mock = source();
		expect(mock.preferences.controls().swipeLeftAction).toBe("members");
		mock.preferences.setControls({ swipeLeftAction: "reply" });
		expect(mock.preferences.controls().swipeLeftAction).toBe("reply");
	});
});

describe("composer data", () => {
	it("forwards a message into another Space with its source", async () => {
		const mock = source();
		const from = await channelBySlug(mock, "hq", "general");
		const to = await channelBySlug(mock, "nightowls", "showcase");
		const page = await mock.listMessages({
			channel: from.channel.space,
			limit: 1,
		});
		const original = page.items[0] as MessageView;
		const forwarded = await mock.forwardMessage({
			from: from.channel.space,
			rkey: original.rkey,
			to: to.channel.space,
			text: "look at this",
		});
		expect(forwarded.channel).toBe(to.channel.space);
		expect(forwarded.text).toBe("look at this");
		expect(forwarded.forward?.text).toBe(original.text);
		expect(forwarded.forward?.sourceName).toBe("general");
		expect(forwarded.forward?.sourceCommunity).toBe(from.community.did);
	});

	it("searches GIFs and remembers favorites", async () => {
		const mock = source();
		const trending = await mock.listGifs();
		expect(trending.length).toBeGreaterThan(3);
		const party = await mock.listGifs("party");
		expect(party.length).toBeGreaterThan(0);
		expect(party.every((gif) => gif.url.startsWith("https://"))).toBe(true);
		const first = party[0] as (typeof party)[number];
		mock.setGifFavorite(first, true);
		expect(mock.gifFavorites().map((gif) => gif.id)).toEqual([first.id]);
		mock.setGifFavorite(first, false);
		expect(mock.gifFavorites()).toEqual([]);
	});

	it("sends attachments with a message", async () => {
		const mock = source();
		const { channel } = await channelBySlug(mock, "hq", "general");
		const sent = await mock.sendMessage({
			channel: channel.space,
			text: "",
			attachments: [
				{
					url: "https://example.com/a.png",
					mimeType: "image/png",
					width: 10,
					height: 10,
				} as MessageView["attachments"][number],
			],
		});
		expect(sent.attachments).toHaveLength(1);
	});

	it("slows everything down on a slow network", () => {
		const mock = source();
		expect(mock.simulation().slowNetwork).toBe(false);
		mock.setSimulation({ slowNetwork: true });
		expect(mock.simulation().slowNetwork).toBe(true);
		mock.setSimulation({ slowNetwork: false });
	});
});

describe("channel summaries", () => {
	it("summarizes the newest message of every channel", async () => {
		setLatency(0);
		const mock = createMockSource({ live: false });
		const [space] = await mock.listCommunities();
		if (!space) throw new Error("no space");
		const channels = await mock.listChannels(space.did);
		const started = performance.now();
		for (const community of await mock.listCommunities()) {
			await mock.listChannelSummaries(community.did);
		}
		expect(performance.now() - started).toBeLessThan(2000);
		const summaries = await mock.listChannelSummaries(space.did);
		const text = channels.find((channel) => channel.name === "general");
		if (!text) throw new Error("no general");
		const page = await mock.listMessages({ channel: text.space, limit: 100 });
		const newest = [...page.items]
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
			.at(-1);
		expect(
			summaries.find((entry) => entry.channel === text.space),
		).toMatchObject({ rkey: newest?.rkey, author: newest?.author.did });
	});
});

describe("thread members", () => {
	it("lists the anchor author and posters, and leaves out the rest of the Space", async () => {
		const mock = source();
		let checked = 0;
		for (const community of await mock.listCommunities()) {
			const everyone = (await mock.listMembers(community.did, { limit: 1000 }))
				.items;
			for (const channel of await mock.listChannels(community.did)) {
				for (const thread of await mock.listThreads(channel.space)) {
					const members = await mock.listThreadMembers(thread.space);
					const posters = (await allMessages(mock, thread.space)).map(
						(message) => message.author.did,
					);
					expect(members[0]).toBe(thread.anchor?.did);
					for (const did of posters) expect(members).toContain(did);
					expect(members.length).toBeLessThan(everyone.length);
					checked++;
				}
			}
		}
		expect(checked).toBeGreaterThan(0);
	});
});
