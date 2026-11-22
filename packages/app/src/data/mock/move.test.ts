import { beforeEach, describe, expect, it } from "vitest";
import { channelSlug } from "../ids";
import { MESSAGE_COLLECTION } from "../source";
import type { ChannelView, MessageView, SpaceRef } from "../types";
import { createMockSource, setLatency } from "./source";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const HQ = "did:plc:colibrihqspace2a4b6c8d";

beforeEach(() => setLatency(0));

const setup = async () => {
	const mock = createMockSource({ now: NOW, live: false });
	const channels = await mock.listChannels(HQ as never);
	const bySlug = (slug: string) =>
		channels.find((entry) => channelSlug(entry) === slug) as ChannelView;
	const dev = bySlug("dev");
	const general = bySlug("general");
	const threads = await mock.listThreads(dev.space);
	const spring = threads.find((thread) => thread.name === "Spring tuning");
	if (!spring) throw new Error("thread missing");
	const list = async (channel: SpaceRef) =>
		(await mock.listMessages({ channel, limit: 100 })).items;
	return { mock, dev, general, spring, list };
};

const subjects = (messages: MessageView[]) =>
	messages.map((message) => ({
		did: message.author.did,
		collection: MESSAGE_COLLECTION,
		rkey: message.rkey,
	}));

describe("mock message moves", () => {
	it("moves messages into a thread in send order and back out", async () => {
		const { mock, dev, spring, list } = await setup();
		const anchor = (spring.anchor as { rkey: string }).rkey;
		const picked = (await list(dev.space))
			.filter((message) => message.rkey !== anchor)
			.slice(0, 2);
		const events: string[] = [];
		const detached: string[] = [];
		mock.subscribe((event) => {
			if (event.$type === "messageEvent") events.push(event.event);
			if (event.$type === "messagesMovedEvent") detached.push(...event.rkeys);
		});
		const result = await mock.moveMessages({
			source: dev.space,
			destination: spring.space,
			subjects: subjects(picked),
		});
		expect(result.count).toBe(2);
		const inThread = (await list(spring.space)).map((message) => message.rkey);
		expect(inThread).toEqual(expect.arrayContaining(picked.map((m) => m.rkey)));
		const ascending = [...inThread].reverse();
		expect([...ascending].sort()).toEqual(ascending);
		const left = (await list(dev.space)).map((message) => message.rkey);
		for (const message of picked) expect(left).not.toContain(message.rkey);
		expect(events.filter((entry) => entry === "create")).toHaveLength(2);
		expect([...detached].sort()).toEqual(picked.map((m) => m.rkey).sort());

		await mock.moveMessages({
			source: spring.space,
			destination: dev.space,
			subjects: subjects(picked.slice(0, 1)),
		});
		const back = await list(dev.space);
		expect(back.some((message) => message.rkey === picked[0]?.rkey)).toBe(true);
	});

	it("rejects empty, oversized and cross-Space moves", async () => {
		const { mock, dev, spring } = await setup();
		await expect(
			mock.moveMessages({
				source: dev.space,
				destination: spring.space,
				subjects: [],
			}),
		).rejects.toThrow();
		await expect(
			mock.moveMessages({
				source: dev.space,
				destination: dev.space,
				subjects: [
					{ did: HQ as never, collection: MESSAGE_COLLECTION, rkey: "x" },
				],
			}),
		).rejects.toThrow();
	});

	it("repoints a thread to another channel", async () => {
		const { mock, general, spring } = await setup();
		const moved = await mock.repoint({
			thread: spring.space,
			channel: general.space,
		});
		expect(moved.channel).toBe(general.space);
		const listed = await mock.listThreads(general.space);
		expect(listed.some((thread) => thread.space === spring.space)).toBe(true);
		await expect(
			mock.repoint({
				thread: spring.space,
				channel: general.space,
				anchor: { space: spring.channel, did: HQ as never, rkey: "nope" },
			}),
		).rejects.toThrow();
	});
});
