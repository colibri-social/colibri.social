import { createEffect, createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { channelSlug, isVoiceChannel } from "./ids";
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

const setupWithEvents = async () => {
	setLatency(0);
	const base = createMockSource({ live: false });
	const listeners = new Set<(event: LiveEvent) => void>();
	const watched: SpaceRef[] = [];
	const released: SpaceRef[] = [];
	const viewed: (SpaceRef | undefined)[] = [];
	const source = {
		...base,
		subscribe: (listener: (event: LiveEvent) => void) => {
			listeners.add(listener);
			const stop = base.subscribe(listener);
			return () => {
				listeners.delete(listener);
				stop();
			};
		},
		watchChannel: (channel: SpaceRef) => {
			watched.push(channel);
			return () => {
				released.push(channel);
			};
		},
		viewChannel: (channel?: SpaceRef) => {
			viewed.push(channel);
		},
	};
	const store = createDataStore(source);
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
		ReturnType<typeof store.communities.value>
	>[number];
	const space = store.space(hq);
	await until(() => !!space.channels.value() && !!space.categories.value());
	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};
	return { store, space, hq, emit, watched, released, viewed };
};

describe("key-only deletes", () => {
	it("drops a channel, category, role and Space from their keys alone", async () => {
		const { store, space, hq, emit } = await setupWithEvents();
		const general = space.channelBySlug("general");
		const category = space.categories.value()?.[0];
		if (!general || !category) throw new Error("fixtures missing");
		emit({
			$type: "channelRemovedEvent",
			community: hq.did,
			channel: general.space,
		});
		expect(space.channelBySlug("general")).toBeUndefined();
		expect(
			space.categories
				.value()
				?.some((entry) =>
					entry.channels.some((channel) => channel.space === general.space),
				),
		).toBe(false);
		emit({
			$type: "categoryRemovedEvent",
			community: hq.did,
			rkey: category.rkey,
		});
		expect(
			space.categories.value()?.some((entry) => entry.rkey === category.rkey),
		).toBe(false);
		emit({ $type: "communityRemovedEvent", community: hq.did });
		expect(
			store.communities.value()?.some((entry) => entry.did === hq.did),
		).toBe(false);
	});
});

describe("channel watching", () => {
	it("views the channel on screen and releases it when the view moves on", async () => {
		const { store, space, watched, released, viewed } = await setupWithEvents();
		const general = space.channelBySlug("general");
		const dev = space.channelBySlug("dev");
		if (!general || !dev) throw new Error("channels missing");
		store.setViewing(general.space);
		expect(watched).toEqual([general.space]);
		expect(viewed).toEqual([general.space]);
		store.setViewing(dev.space);
		expect(released).toEqual([general.space]);
		expect(watched).toEqual([general.space, dev.space]);
		expect(viewed).toEqual([general.space, undefined, dev.space]);
		store.setViewing(undefined);
		expect(released).toEqual([general.space, dev.space]);
		expect(viewed).toEqual([general.space, undefined, dev.space, undefined]);
		store.dispose();
	});

	it("keeps a covered channel watched until its layer closes", async () => {
		const { store, space, watched, released, viewed } = await setupWithEvents();
		const general = space.channelBySlug("general");
		if (!general) throw new Error("channel missing");
		const thread: SpaceRef =
			"at://did:plc:thread/space/social.colibri.beta.thread/one";
		const releaseLayer = store.holdChannel(general.space);
		store.setViewing(general.space);
		expect(watched).toEqual([general.space]);
		const releaseThread = store.holdChannel(thread);
		store.setViewing(thread);
		expect(viewed).toEqual([general.space, undefined, thread]);
		expect(watched).toEqual([general.space, thread]);
		expect(released).toEqual([]);
		store.setViewing(undefined);
		releaseThread();
		expect(released).toEqual([thread]);
		store.setViewing(general.space);
		expect(watched).toEqual([general.space, thread]);
		store.setViewing(undefined);
		expect(released).toEqual([thread]);
		releaseLayer();
		releaseLayer();
		expect(released).toEqual([thread, general.space]);
		store.dispose();
	});
});

describe("channel layout", () => {
	const setupMismatch = async () => {
		setLatency(0);
		const base = createMockSource({ live: false });
		const listeners = new Set<(event: LiveEvent) => void>();
		let stripped: SpaceRef | undefined;
		const source = {
			...base,
			subscribe: (listener: (event: LiveEvent) => void) => {
				listeners.add(listener);
				const stop = base.subscribe(listener);
				return () => {
					listeners.delete(listener);
					stop();
				};
			},
			listChannels: async (
				community: Parameters<typeof base.listChannels>[0],
			) => {
				const list = await base.listChannels(community);
				const target = list.find((entry) => entry.category);
				stripped = target?.space;
				return list.map((entry) => {
					if (entry !== target) return entry;
					const copy = { ...entry };
					delete copy.category;
					return copy;
				});
			},
		};
		const store = createDataStore(source);
		await until(() => !!store.communities.value());
		const hq = store.communities
			.value()
			?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
			ReturnType<typeof store.communities.value>
		>[number];
		const space = store.space(hq);
		await until(() => !!space.channels.value() && !!space.categories.value());
		if (!stripped) throw new Error("no categorized channel");
		const target = stripped;
		const copies = () => {
			const id = target.split("/").pop();
			const matches = (ref: string) => ref.split("/").pop() === id;
			const loose = (space.channels.value() ?? []).filter(
				(entry) => !entry.category && matches(entry.space),
			).length;
			const grouped = (space.categories.value() ?? []).reduce(
				(count, category) =>
					count +
					category.channels.filter((entry) => matches(entry.space)).length,
				0,
			);
			return { loose, grouped };
		};
		const emit = (event: LiveEvent) => {
			for (const listener of listeners) listener(event);
		};
		return { store, space, hq, target, copies, emit };
	};

	it("shows a channel once when the list and its category disagree", async () => {
		const { space, target, copies } = await setupMismatch();
		expect(copies()).toEqual({ loose: 0, grouped: 1 });
		const fromList = space.channels
			.value()
			?.find((entry) => entry.space === target);
		expect(fromList?.category).toBeDefined();
	});

	it("keeps one copy through a live update with another ref spelling", async () => {
		const { space, hq, target, copies, emit } = await setupMismatch();
		const view = space.channels
			.value()
			?.find((entry) => entry.space === target);
		if (!view) throw new Error("channel missing");
		const respelled = target.includes(".text/")
			? target.replace(".text/", ".voice/")
			: target.replace(".voice/", ".text/");
		emit({
			$type: "channelEvent",
			event: "update",
			community: hq.did,
			channel: { ...view, space: respelled as SpaceRef, name: "renamed" },
		});
		const { loose, grouped } = copies();
		expect(loose + grouped).toBe(1);
		emit({
			$type: "channelEvent",
			event: "create",
			community: hq.did,
			channel: view,
		});
		const after = copies();
		expect(after.loose + after.grouped).toBe(1);
	});

	it("adds no copy when joining a voice channel", async () => {
		const { store, space, hq, copies } = await setupMismatch();
		const voiceChannel = space.channels
			.value()
			?.find((entry) => entry.type === "social.colibri.beta.channel.voice");
		if (!voiceChannel) throw new Error("voice channel missing");
		const total = () =>
			(space.channels.value() ?? []).length +
			(space.categories.value() ?? []).reduce(
				(count, category) => count + category.channels.length,
				0,
			);
		const before = { total: total(), copies: copies() };
		await store.setVoice({
			channel: voiceChannel.space,
			community: hq.did,
		} as Parameters<typeof store.setVoice>[0]);
		expect(total()).toBe(before.total);
		expect(copies()).toEqual(before.copies);
	});
});

describe("optimistic send", () => {
	const setupSend = async (echo: "before" | "after" | "none") => {
		setLatency(0);
		const base = createMockSource({ live: false });
		const listeners = new Set<(event: LiveEvent) => void>();
		let muted = false;
		const emit = (event: LiveEvent) => {
			for (const listener of listeners) listener(event);
		};
		const source = {
			...base,
			subscribe: (listener: (event: LiveEvent) => void) => {
				const forward = (event: LiveEvent) => {
					if (!muted) listener(event);
				};
				listeners.add(listener);
				const stop = base.subscribe(forward);
				return () => {
					listeners.delete(listener);
					stop();
				};
			},
			sendMessage: async (input: Parameters<typeof base.sendMessage>[0]) => {
				muted = true;
				const view = await base.sendMessage(input).finally(() => {
					muted = false;
				});
				const event: LiveEvent = {
					$type: "messageEvent",
					event: "create",
					channel: input.channel,
					message: view,
				};
				if (echo === "before") {
					emit(event);
					await new Promise((resolve) => setTimeout(resolve, 30));
				}
				if (echo === "after") setTimeout(() => emit(event), 30);
				return view;
			},
		};
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
		return { store, channel };
	};

	const recordSend = async (echo: "before" | "after" | "none") => {
		const { store, channel } = await setupSend(echo);
		const states: string[] = [];
		const keys = new Set<string>();
		const before = new Set(channel.messages().map((entry) => entry.rkey));
		const stop = createRoot((dispose) => {
			createEffect(() => {
				const pending = channel
					.pending()
					.find((entry) => entry.text === "hello");
				const sent = channel
					.messages()
					.filter((entry) => !before.has(entry.rkey) && entry.text === "hello");
				if (pending) keys.add(pending.nonce);
				for (const entry of sent)
					keys.add(store.nonceFor(entry.rkey) ?? entry.rkey);
				const state =
					pending && sent.length
						? "both"
						: pending
							? pending.state
							: sent.length === 1
								? "sent"
								: sent.length > 1
									? "duplicate"
									: "none";
				if (states.at(-1) !== state) states.push(state);
			});
			return dispose;
		});
		await channel.send({ text: "hello" });
		await new Promise((resolve) => setTimeout(resolve, 80));
		stop();
		return { states, keys };
	};

	for (const echo of ["before", "after", "none"] as const) {
		it(`goes from pending to sent once with the echo ${echo === "none" ? "missing" : `${echo} the response`}`, async () => {
			const { states, keys } = await recordSend(echo);
			expect(states).toEqual(["none", "pending", "sent"]);
			expect(keys.size).toBe(1);
		});
	}
});

describe("read state", () => {
	it("goes unread on a new message, reads again on open, and updates totals", async () => {
		const { store, space, hq, emit } = await setupWithEvents();
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		const feed = store.channel(general.space);
		await until(() => feed.ready());
		store.setViewing(general.space);
		feed.markRead();
		expect(space.unread("general").hasUnread).toBe(false);
		store.setViewing(undefined);
		const author = feed
			.messages()
			.find((entry) => entry.author.did !== store.viewer.did)?.author;
		const last = feed.messages().at(-1);
		if (!author || !last) throw new Error("fixtures missing");
		emit({
			$type: "messageEvent",
			event: "create",
			channel: general.space,
			message: {
				...last,
				rkey: `${last.rkey}z`,
				uri: `${last.uri}z`,
				author,
				text: "while you were away",
			},
		});
		expect(space.unread("general").hasUnread).toBe(true);
		expect(space.totals().hasUnread).toBe(true);
		store.setViewing(general.space);
		feed.markRead();
		expect(space.unread("general").hasUnread).toBe(false);
		expect(hq.did).toBeTruthy();
		store.dispose();
	});

	it("applies a seen event from another device to notifications and mention counts", async () => {
		const { store, space, emit } = await setupWithEvents();
		await until(() => store.notifications.status() === "ready");
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		const feed = store.channel(general.space);
		await until(() => feed.ready());
		const author = feed
			.messages()
			.find((entry) => entry.author.did !== store.viewer.did)?.author;
		if (!author) throw new Error("author missing");
		const before = store.notifications.unreadCount();
		const indexedAt = new Date(Date.now() - 1000).toISOString();
		emit({
			$type: "notificationEvent",
			notification: {
				id: "cross-device-mention",
				kind: "mention",
				author,
				channel: general.space,
				community: space.community.did,
				message: feed.messages().at(-1),
				indexedAt,
			} as never,
		});
		expect(store.notifications.unreadCount()).toBe(before + 1);
		expect(space.unread("general").mentions).toBeGreaterThan(0);
		emit({
			$type: "seenEvent",
			unread: 0,
			seenAt: new Date().toISOString() as never,
		});
		expect(store.notifications.unreadCount()).toBe(0);
		expect(space.unread("general").mentions).toBe(0);
		store.dispose();
	});

	it("clears a channel another device read up to its newest message", async () => {
		const { store, space, emit } = await setupWithEvents();
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		const feed = store.channel(general.space);
		await until(() => feed.ready());
		const author = feed
			.messages()
			.find((entry) => entry.author.did !== store.viewer.did)?.author;
		const last = feed.messages().at(-1);
		if (!author || !last) throw new Error("fixtures missing");
		const fresh = `${last.rkey}z`;
		emit({
			$type: "messageEvent",
			event: "create",
			channel: general.space,
			message: { ...last, rkey: fresh, uri: `${last.uri}z`, author },
		});
		expect(space.unread("general").hasUnread).toBe(true);
		emit({
			$type: "readCursorEvent",
			community: space.community.did,
			cursors: [{ channel: "general", cursor: last.rkey }],
		});
		expect(space.unread("general").hasUnread).toBe(true);
		emit({
			$type: "readCursorEvent",
			community: space.community.did,
			cursors: [{ channel: "general", cursor: fresh }],
		});
		expect(space.unread("general").hasUnread).toBe(false);
		store.dispose();
	});

	it("clears one notification another device saw", async () => {
		const { store, space, emit } = await setupWithEvents();
		await until(() => store.notifications.status() === "ready");
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		const feed = store.channel(general.space);
		await until(() => feed.ready());
		const message = feed
			.messages()
			.find((entry) => entry.author.did !== store.viewer.did);
		if (!message) throw new Error("message missing");
		const before = store.notifications.unreadCount();
		const mentionsBefore = space.unread("general").mentions;
		emit({
			$type: "notificationEvent",
			notification: {
				id: "single-seen-mention",
				kind: "mention",
				author: message.author,
				channel: general.space,
				community: space.community.did,
				message,
				indexedAt: new Date().toISOString(),
			} as never,
		});
		expect(store.notifications.unreadCount()).toBe(before + 1);
		emit({
			$type: "seenEvent",
			channel: general.space,
			message: { did: message.author.did, rkey: message.rkey },
			unread: before,
			seenAt: new Date().toISOString() as never,
		});
		expect(
			store.notifications
				.items()
				.find((entry) => entry.id === "single-seen-mention")?.seenAt,
		).toBeTruthy();
		expect(space.unread("general").mentions).toBe(mentionsBefore);
		store.dispose();
	});

	it("marks an opened thread read in the thread list, nested rows and notifications", async () => {
		const { store, space, emit } = await setupWithEvents();
		await until(() => store.notifications.status() === "ready");
		const general = space.channelBySlug("dev");
		if (!general) throw new Error("dev missing");
		const parent = store.channel(general.space);
		await until(() => parent.ready());
		await until(() => (parent.threads.value()?.length ?? 0) > 0);
		const original = parent.threads.value()?.[0];
		if (!original) throw new Error("thread missing");
		emit({
			$type: "threadEvent",
			event: "update",
			thread: {
				...original,
				viewer: { ...original.viewer, hasUnread: true, unreadMentions: 2 },
			},
		});
		const author = parent
			.messages()
			.find((entry) => entry.author.did !== store.viewer.did)?.author;
		if (!author) throw new Error("author missing");
		emit({
			$type: "notificationEvent",
			notification: {
				id: "thread-mention",
				kind: "mention",
				author,
				channel: general.space,
				thread: original.space,
				community: space.community.did,
				message: parent.messages().at(-1),
				indexedAt: new Date().toISOString(),
			} as never,
		});
		const opened = () => store.threads.find(original.space);
		expect(opened()?.viewer.hasUnread).toBe(true);
		expect(opened()?.viewer.unreadMentions).toBe(2);
		const markRead = store.channel(original.space).markRead;
		markRead();
		const after = store.threads.find(original.space);
		expect(after?.viewer.hasUnread).toBe(false);
		expect(after?.viewer.unreadMentions).toBe(0);
		expect(
			parent.threads.value()?.find((entry) => entry.space === original.space)
				?.viewer.hasUnread,
		).toBe(false);
		await until(
			() =>
				!store.notifications
					.items()
					.some((entry) => entry.id === "thread-mention" && !entry.seenAt),
		);
		expect(space.unread(original.space.split("/").at(-1) ?? "").hasUnread).toBe(
			false,
		);
		store.dispose();
	});
});

describe("catch-up on resume", () => {
	const setupQuiet = async () => {
		setLatency(0);
		const base = createMockSource({ live: false });
		const listed: SpaceRef[] = [];
		const calls = { threads: 0, members: 0, channels: 0, categories: 0 };
		const live = { messages: false };
		const source = {
			...base,
			subscribe: (listener: (event: LiveEvent) => void) =>
				base.subscribe((event) => {
					if (live.messages || event.$type !== "messageEvent") listener(event);
				}),
			listMessages: (params: Parameters<typeof base.listMessages>[0]) => {
				listed.push(params.channel);
				return base.listMessages(params);
			},
			listThreads: (channel: SpaceRef) => {
				calls.threads += 1;
				return base.listThreads(channel);
			},
			listMembers: (...args: Parameters<typeof base.listMembers>) => {
				calls.members += 1;
				return base.listMembers(...args);
			},
			listChannels: (...args: Parameters<typeof base.listChannels>) => {
				calls.channels += 1;
				return base.listChannels(...args);
			},
			listCategories: (...args: Parameters<typeof base.listCategories>) => {
				calls.categories += 1;
				return base.listCategories(...args);
			},
			markRead: (...args: Parameters<typeof base.markRead>) =>
				base.markRead(...args),
		};
		const store = createDataStore(source);
		await until(() => !!store.communities.value());
		const hq = store.communities
			.value()
			?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
			ReturnType<typeof store.communities.value>
		>[number];
		const space = store.space(hq);
		await until(() => !!space.channels.value());
		const ref = (slug: string) => {
			const view = space.channelBySlug(slug);
			if (!view) throw new Error(`${slug} missing`);
			return view.space;
		};
		return { base, store, space, ref, listed, calls, live };
	};

	const flood = (
		base: Awaited<ReturnType<typeof setupQuiet>>["base"],
		channel: SpaceRef,
		author: MessageView["author"]["did"],
		count: number,
	) =>
		Array.from({ length: count }, (_, index) =>
			base.simulateMessage({ author, channel, text: `missed ${index}` }),
		);

	const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

	it("merges missed messages into the open channel and backfills the others", async () => {
		const { base, store, ref, listed } = await setupQuiet();
		const general = store.channel(ref("general"));
		const dev = store.channel(ref("dev"));
		await until(() => general.ready() && dev.ready());
		store.setViewing(ref("general"));
		const generalBefore = general.messages();
		const devBefore = dev.messages();
		const author = generalBefore[0]?.author.did;
		if (!author) throw new Error("no author");

		const missed = base.simulateMessage({
			author,
			channel: ref("general"),
			text: "sent while you were away",
		});
		const flood = Array.from({ length: 70 }, (_, index) =>
			base.simulateMessage({
				author,
				channel: ref("dev"),
				text: `catch-up ${index}`,
			}),
		);
		expect(general.messages().some((m) => m.rkey === missed.rkey)).toBe(false);

		listed.length = 0;
		store.catchUp();
		expect(listed[0]).toBe(ref("general"));
		await until(() => general.messages().some((m) => m.rkey === missed.rkey));
		expect(general.messages().slice(0, generalBefore.length)).toEqual(
			generalBefore,
		);

		await until(() =>
			flood.every((sent) => dev.messages().some((m) => m.rkey === sent.rkey)),
		);
		expect(dev.messages().slice(0, devBefore.length)).toEqual(devBefore);
		store.setViewing(undefined);
	});

	it("refreshes unread state for loaded Spaces", async () => {
		const { base, store, space, ref } = await setupQuiet();
		const general = store.channel(ref("general"));
		await until(() => general.ready() && space.totals().hasUnread);
		const author = general.messages()[0]?.author.did;
		if (!author) throw new Error("no author");
		const read = (space.channels.value() ?? []).find(
			(view) =>
				!isVoiceChannel(view) &&
				view.space !== ref("general") &&
				!space.unread(channelSlug(view)).hasUnread,
		);
		if (!read) throw new Error("no read channel");
		base.simulateMessage({
			author,
			channel: read.space,
			text: "missed in another channel",
		});
		store.catchUp();
		await until(() => space.unread(channelSlug(read)).hasUnread);
	});

	it("stops the background queue when paused", async () => {
		const { store, space, listed } = await setupQuiet();
		const refs = (space.channels.value() ?? [])
			.filter((view) => !isVoiceChannel(view))
			.map((view) => view.space)
			.slice(0, 5);
		expect(refs.length).toBeGreaterThan(2);
		for (const ref of refs) store.channel(ref);
		await until(() => refs.every((ref) => store.channel(ref).ready()));
		listed.length = 0;
		store.catchUp();
		store.pauseCatchUp();
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(listed.length).toBeLessThanOrEqual(2);
	});

	it("keeps the open channel in place across a large gap and fills it downward", async () => {
		const { base, store, ref } = await setupQuiet();
		const general = store.channel(ref("general"));
		await until(() => general.ready());
		store.setViewing(ref("general"));
		const before = general.messages();
		const author = before[0]?.author.did;
		if (!author) throw new Error("no author");
		const missed = flood(base, ref("general"), author, 300);

		store.catchUp();
		await until(() => general.hasNewer());
		expect(general.messages()).toBe(before);

		while (general.hasNewer()) {
			general.loadNewer();
			await until(() => !general.loadingNewer());
		}
		const rkeys = general.messages().map((message) => message.rkey);
		expect(general.messages().slice(0, before.length)).toEqual(before);
		expect(new Set(rkeys).size).toBe(rkeys.length);
		expect([...rkeys].sort()).toEqual(rkeys);
		for (const sent of missed) expect(rkeys).toContain(sent.rkey);
		store.setViewing(undefined);
	});

	it("jumps to the newest messages across a gap and routes live messages past it", async () => {
		const { base, store, ref, live } = await setupQuiet();
		const general = store.channel(ref("general"));
		await until(() => general.ready());
		store.setViewing(ref("general"));
		const before = general.messages();
		const author = before[0]?.author.did;
		if (!author) throw new Error("no author");
		const missed = flood(base, ref("general"), author, 300);
		store.catchUp();
		await until(() => general.hasNewer());

		live.messages = true;
		const arrived = base.simulateMessage({
			author,
			channel: ref("general"),
			text: "arrived during the gap",
		});
		await settle();
		expect(general.messages()).toBe(before);

		general.jumpToLatest();
		expect(general.hasNewer()).toBe(false);
		const rkeys = general.messages().map((message) => message.rkey);
		expect(rkeys.at(-1)).toBe(arrived.rkey);
		expect(rkeys).toContain(missed.at(-1)?.rkey);
		expect(rkeys).not.toContain(before.at(-1)?.rkey);
		store.setViewing(undefined);
	});

	it("marks read only through the loaded messages while a gap is open", async () => {
		const { base, store, ref } = await setupQuiet();
		const general = store.channel(ref("general"));
		await until(() => general.ready());
		store.setViewing(ref("general"));
		const author = general.messages()[0]?.author.did;
		if (!author) throw new Error("no author");
		flood(base, ref("general"), author, 300);
		store.catchUp();
		await until(() => general.hasNewer());

		const marked: (string | undefined)[] = [];
		const markRead = base.markRead;
		base.markRead = (channel, through) => {
			marked.push(through);
			return markRead(channel, through);
		};
		general.markRead();
		expect(marked).toEqual([general.messages().at(-1)?.rkey]);

		general.jumpToLatest();
		general.markRead();
		expect(marked.at(-1)).toBeUndefined();
		base.markRead = markRead;
		store.setViewing(undefined);
	});

	it("never marks the channel on screen as unread", async () => {
		const { base, store, space, ref } = await setupQuiet();
		const general = store.channel(ref("general"));
		await until(() => general.ready() && space.totals().hasUnread);
		store.setViewing(ref("general"));
		general.markRead();
		const author = general.messages()[0]?.author.did;
		if (!author) throw new Error("no author");
		const read = (space.channels.value() ?? []).find(
			(view) =>
				!isVoiceChannel(view) &&
				view.space !== ref("general") &&
				!space.unread(channelSlug(view)).hasUnread,
		);
		if (!read) throw new Error("no read channel");
		await until(() => !space.unread("general").hasUnread);
		base.simulateMessage({
			author,
			channel: ref("general"),
			text: "on screen",
		});
		base.simulateMessage({ author, channel: read.space, text: "elsewhere" });
		store.catchUp();
		await until(() => space.unread(channelSlug(read)).hasUnread);
		expect(space.unread("general").hasUnread).toBe(false);
		store.setViewing(undefined);
	});

	it("keeps unchanged thread rows and lists across a refresh", async () => {
		const { store, space, ref, calls } = await setupQuiet();
		const general = store.channel(ref("general"));
		await until(() => general.ready());
		store.setViewing(ref("general"));
		const threads = store.threadsOf(ref("general"));
		await until(() => !!threads.value());
		const rows = threads.value();
		const channels = space.channels.value();
		const categories = space.categories.value();
		const counted = { ...calls };
		store.catchUp();
		await until(
			() =>
				calls.threads > counted.threads &&
				calls.channels > counted.channels &&
				calls.categories > counted.categories,
		);
		await settle();
		expect(threads.value()).toBe(rows);
		expect(space.channels.value()).toBe(channels);
		expect(space.categories.value()).toBe(categories);
		store.setViewing(undefined);
	});

	it("queues a member refresh only for Spaces with loaded members", async () => {
		const { store, space, calls } = await setupQuiet();
		store.catchUp();
		await settle();
		expect(calls.members).toBe(0);
		await until(() => !!space.members.value());
		const members = space.members.value();
		const counted = calls.members;
		await new Promise((resolve) => setTimeout(resolve, 1_100));
		store.catchUp();
		await until(() => calls.members > counted);
		await settle();
		expect(space.members.value()).toBe(members);
	});
});
