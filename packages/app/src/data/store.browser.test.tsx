import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { createDataStore } from "./store";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const setup = async () => {
	setLatency(0);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
		ReturnType<typeof store.communities.value>
	>[number];
	const space = store.space(hq);
	await until(() => !!space.channels.value());
	const general = space.channelBySlug("general");
	if (!general) throw new Error("general missing");
	const channel = store.channel(general.space);
	await until(() => channel.ready());
	return { store, channel, hq };
};

describe("upload on send", () => {
	it("uploads attached files only when the message is sent", async () => {
		const { channel } = await setup();
		const before = channel.messages().length;
		const file = new File([new Uint8Array(2000)], "notes.txt", {
			type: "text/plain",
		});
		const progress: number[] = [];
		const sending = channel.send({ text: "with a file", files: [{ file }] });
		await until(() => channel.pending().length === 1);
		const watch = setInterval(() => {
			const upload = channel.pending()[0]?.uploads?.[0];
			if (upload) progress.push(upload.progress);
		}, 30);
		await sending;
		clearInterval(watch);
		expect(channel.pending()).toHaveLength(0);
		const sent = channel.messages().at(-1);
		expect(channel.messages().length).toBe(before + 1);
		expect(sent?.attachments[0]?.name).toBe("notes.txt");
		expect(progress.some((value) => value > 0 && value < 1)).toBe(true);
	});

	it("fails the message when an upload fails", async () => {
		const { channel } = await setup();
		const file = new File([new Uint8Array(10)], "fail.txt", {
			type: "text/plain",
		});
		await channel.send({ text: "this upload breaks", files: [{ file }] });
		const entry = channel.pending()[0];
		expect(entry?.state).toBe("failed");
		expect(entry?.uploads?.[0]?.failed).toBe(true);
	});
});

describe("thread lists", () => {
	it("moves an anchored thread to its new channel's list", async () => {
		const { store } = await setup();
		const hq = store.communities
			.value()
			?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
			ReturnType<typeof store.communities.value>
		>[number];
		const space = store.space(hq);
		const dev = space.channelBySlug("dev");
		const general = space.channelBySlug("general");
		if (!dev || !general) throw new Error("channels missing");
		const devFeed = store.channel(dev.space);
		const generalFeed = store.channel(general.space);
		await until(
			() =>
				devFeed.ready() &&
				!!devFeed.threads.value() &&
				!!generalFeed.threads.value(),
		);
		const spring = devFeed.threads
			.value()
			?.find((thread) => thread.name === "Spring tuning");
		const anchorRkey = (spring?.anchor as { rkey?: string } | undefined)?.rkey;
		const anchor = devFeed
			.messages()
			.find((message) => message.rkey === anchorRkey);
		if (!spring || !anchor) throw new Error("thread missing");
		await store.moveMessages({
			source: dev.space,
			destination: general.space,
			messages: [anchor],
		});
		await until(
			() =>
				!!generalFeed.threads
					.value()
					?.some((thread) => thread.space === spring.space),
		);
		expect(
			devFeed.threads.value()?.some((thread) => thread.space === spring.space),
		).toBe(false);
	});
});

describe("unread marker", () => {
	it("keeps the marker when reading by viewing", async () => {
		const { channel } = await setup();
		expect(channel.unreadAfter()).toBeDefined();
		channel.markRead();
		expect(channel.unreadAfter()).toBeDefined();
	});

	it("clears the marker when the channel is marked as read", async () => {
		const { channel } = await setup();
		expect(channel.unreadAfter()).toBeDefined();
		channel.markRead();
		channel.clearUnreadMarker();
		expect(channel.unreadAfter()).toBeUndefined();
		expect(channel.enter(false)).toBeUndefined();
		expect(channel.unreadAfter()).toBeUndefined();
	});

	it("clears the open channel's marker when its Space is marked as read", async () => {
		const { store, channel, hq } = await setup();
		expect(channel.unreadAfter()).toBeDefined();
		await store.community.markRead(hq.did);
		expect(channel.unreadAfter()).toBeUndefined();
	});
});
