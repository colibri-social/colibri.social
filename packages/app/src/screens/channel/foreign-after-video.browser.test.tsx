import "../../app.css";
import { nextTid } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
	createMockSource,
	type MockSource,
	setLatency,
} from "../../data/mock/source";
import type { ListMessagesParams, LiveEvent } from "../../data/source";
import { createDataStore, DataContext } from "../../data/store";
import type {
	AttachmentView,
	Datetime,
	Did,
	MessageView,
	NotificationView,
	SpaceRef,
} from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import {
	articleWithText,
	DEV_PATH,
	HQ,
	main,
	until,
	wait,
} from "./desktop-test-kit";

type Store = ReturnType<typeof createDataStore>;

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
	setLatency(0);
});

const holdOwnEchoes = (source: MockSource) => {
	const listeners = new Set<(event: LiveEvent) => void>();
	const held: LiveEvent[] = [];
	let holding = false;
	const subscribe = source.subscribe;
	source.subscribe = (listener) => {
		const filtered = (event: LiveEvent) => {
			if (
				holding &&
				event.$type === "messageEvent" &&
				event.message?.author.did === source.world.viewerDid
			) {
				held.push(event);
				return;
			}
			listener(event);
		};
		listeners.add(filtered);
		const stop = subscribe(filtered);
		return () => {
			listeners.delete(filtered);
			stop();
		};
	};
	return {
		hold: () => {
			holding = true;
		},
		release: () => {
			holding = false;
			for (const event of held.splice(0)) {
				for (const listener of [...listeners]) listener(event);
			}
		},
	};
};

const mountWith = async (prepare?: (source: MockSource) => void) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", DEV_PATH);
	const source = createMockSource({ live: false });
	prepare?.(source);
	const store = createDataStore(source);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(
		() =>
			document.querySelectorAll("[data-shell-main] article[data-message-key]")
				.length > 3,
	);
	await wait(200);
	return { store, source };
};

const devFeed = (store: Store) => {
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("hq missing");
	const dev = store.space(hq).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	return store.channel(dev.space);
};

const channelList = (source: MockSource, ref: SpaceRef) => {
	const record = source.world.spaces
		.flatMap((space) => space.channels)
		.find((channel) => channel.view.space === ref);
	if (!record) throw new Error("channel missing");
	return source.world.messagesOf(record);
};

const sortWorld = (source: MockSource, ref: SpaceRef) => {
	channelList(source, ref).sort((left, right) =>
		left.rkey < right.rkey ? -1 : left.rkey > right.rkey ? 1 : 0,
	);
};

const otherAuthor = (feed: ReturnType<Store["channel"]>, viewer: Did) => {
	const other = feed
		.messages()
		.find((message) => message.author.did !== viewer)?.author;
	if (!other) throw new Error("no other author");
	return other;
};

const foreign = (
	source: MockSource,
	ref: SpaceRef,
	author: MessageView["author"],
	text: string,
	rkey = nextTid(),
): MessageView => {
	const message: MessageView = {
		uri: `at://${author.did}/social.colibri.beta.message/${rkey}` as MessageView["uri"],
		rkey,
		channel: ref,
		author,
		text,
		createdAt: new Date().toISOString() as MessageView["createdAt"],
		attachments: [],
		reactions: [],
		labels: [],
	};
	channelList(source, ref).push(message);
	sortWorld(source, ref);
	return message;
};

const deliver = (source: MockSource, message: MessageView) =>
	source.emit({
		$type: "messageEvent",
		event: "create",
		channel: message.channel,
		message,
	});

const slowUploads = (source: MockSource, ms: number) => {
	const upload = source.uploadBlob;
	source.uploadBlob = async (file, options) => {
		await wait(ms);
		return upload(file, options);
	};
};

const videoFile = () =>
	new File([new Uint8Array(2048)], "clip.webm", { type: "video/webm" });

const rendered = (text: string) => !!articleWithText(main(), text);

const listed = (feed: ReturnType<Store["channel"]>, text: string) =>
	feed.messages().some((message) => message.text === text);

const settle = async (feed: ReturnType<Store["channel"]>) => {
	await until(() => feed.pending().length === 0);
	await wait(150);
};

const expectBoth = async (feed: ReturnType<Store["channel"]>) => {
	await wait(400);
	expect(listed(feed, "And I can't see it")).toBe(true);
	expect(listed(feed, "great")).toBe(true);
	expect(rendered("And I can't see it")).toBe(true);
	expect(rendered("great")).toBe(true);
};

it("keeps both foreign messages after a slow video send lands echo first", async () => {
	const { store, source } = await mountWith((source) =>
		slowUploads(source, 1500),
	);
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	const video = feed.send({
		text: "Video clip",
		files: [{ file: videoFile() }],
	});
	const text = feed.send({ text: "this took a while to upload" });
	await Promise.all([video, text]);
	await settle(feed);

	deliver(source, foreign(source, feed.channel, other, "And I can't see it"));
	await wait(50);
	deliver(source, foreign(source, feed.channel, other, "great"));

	await expectBoth(feed);
});

it("keeps both foreign messages when the echo lands after the sent event", async () => {
	let echoes: ReturnType<typeof holdOwnEchoes> | undefined;
	const { store, source } = await mountWith((source) => {
		slowUploads(source, 1500);
		echoes = holdOwnEchoes(source);
	});
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	echoes?.hold();
	await feed.send({ text: "Video clip", files: [{ file: videoFile() }] });
	await feed.send({ text: "this took a while to upload" });
	await wait(100);
	echoes?.release();
	await settle(feed);

	deliver(source, foreign(source, feed.channel, other, "And I can't see it"));
	await wait(50);
	deliver(source, foreign(source, feed.channel, other, "great"));

	await expectBoth(feed);
});

it("keeps a foreign message that lands while the video is uploading", async () => {
	const { store, source } = await mountWith((source) =>
		slowUploads(source, 1500),
	);
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	const video = feed.send({
		text: "Video clip",
		files: [{ file: videoFile() }],
	});
	await wait(500);
	deliver(source, foreign(source, feed.channel, other, "And I can't see it"));
	await video;
	sortWorld(source, feed.channel);
	await feed.send({ text: "this took a while to upload" });
	await settle(feed);
	deliver(source, foreign(source, feed.channel, other, "great"));

	await expectBoth(feed);
});

const delayedSnapshots = (source: MockSource, ms: number) => {
	const listMessages = source.listMessages;
	let armed = false;
	source.listMessages = async (params: ListMessagesParams) => {
		const snapshot = await listMessages(params);
		if (armed) await wait(ms);
		return structuredClone(snapshot);
	};
	return {
		arm: () => {
			armed = true;
		},
	};
};

it("keeps a foreign message that lands during a catch-up refresh", async () => {
	let snapshots: ReturnType<typeof delayedSnapshots> | undefined;
	const { store, source } = await mountWith((source) => {
		slowUploads(source, 1500);
		snapshots = delayedSnapshots(source, 600);
	});
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	await feed.send({ text: "Video clip", files: [{ file: videoFile() }] });
	await feed.send({ text: "this took a while to upload" });
	await settle(feed);

	snapshots?.arm();
	store.catchUp();
	await wait(150);
	deliver(source, foreign(source, feed.channel, other, "And I can't see it"));
	await wait(1000);
	deliver(source, foreign(source, feed.channel, other, "great"));

	await expectBoth(feed);
});

const skewedBehind = (rkey: string) => {
	const chars = "234567abcdefghijklmnopqrstuvwxyz";
	let at = rkey.length - 5;
	while (at > 0 && rkey[at] === "2") at -= 1;
	const digit = chars.indexOf(rkey[at] as string);

	return `${rkey.slice(0, at)}${chars[digit - 1]}${rkey.slice(at + 1)}`;
};

it("keeps a foreign message from a slower clock that lands during a catch-up refresh", async () => {
	let snapshots: ReturnType<typeof delayedSnapshots> | undefined;
	const { store, source } = await mountWith((source) => {
		slowUploads(source, 1500);
		snapshots = delayedSnapshots(source, 600);
	});
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	await feed.send({ text: "Video clip", files: [{ file: videoFile() }] });
	await feed.send({ text: "this took a while to upload" });
	await settle(feed);
	const ownText = feed.messages().at(-1)?.rkey as string;

	snapshots?.arm();
	store.catchUp();
	await wait(150);
	deliver(
		source,
		foreign(
			source,
			feed.channel,
			other,
			"And I can't see it",
			skewedBehind(ownText),
		),
	);
	await wait(1000);
	deliver(source, foreign(source, feed.channel, other, "great"));

	await expectBoth(feed);
});

const notify = (source: MockSource, message: MessageView) =>
	source.emit({
		$type: "notificationEvent",
		notification: {
			id: `mention:test:${message.rkey}`,
			kind: "mention",
			author: message.author,
			channel: message.channel,
			community: HQ as NotificationView["community"],
			message: { ...message, attachments: [] },
			indexedAt: new Date().toISOString() as Datetime,
		},
	});

const recordedVideo = async () => {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 48;
	const context = canvas.getContext("2d");
	const recorder = new MediaRecorder(canvas.captureStream(30), {
		mimeType: "video/webm",
	});
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => chunks.push(event.data);
	const stopped = new Promise((resolve) => {
		recorder.onstop = resolve;
	});

	recorder.start();

	for (let frame = 0; frame < 12; frame++) {
		if (context) {
			context.fillStyle = frame % 2 ? "#a37" : "#3a7";
			context.fillRect(0, 0, 64, 48);
		}
		await wait(30);
	}

	recorder.stop();
	await stopped;

	return new Blob(chunks, { type: "video/webm" });
};

const withVideo = async (message: MessageView) => {
	message.attachments = [
		{
			url: URL.createObjectURL(await recordedVideo()) as AttachmentView["url"],
			mimeType: "video/webm",
			name: "clip.webm",
			size: 2048,
		},
	];
	return message;
};

const countAround = (source: MockSource, fail = false) => {
	const listMessages = source.listMessages;
	const around: string[] = [];
	let armed = false;
	source.listMessages = async (params: ListMessagesParams) => {
		if (armed && params.around) {
			around.push(params.around);
			if (fail) throw new Error("listMessages failed");
		}
		return listMessages(params);
	};
	return {
		around,
		arm: () => {
			armed = true;
		},
	};
};

const tileIn = (text: string) =>
	!!articleWithText(main(), text)?.querySelector("[data-media-tile]");

it("replaces a notified copy of a missed message with the full server view", async () => {
	let calls: ReturnType<typeof countAround> | undefined;
	const { store, source } = await mountWith((source) => {
		calls = countAround(source);
	});
	calls?.arm();
	const around = calls?.around ?? [];
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	const missed = await withVideo(
		foreign(source, feed.channel, other, "Clip the socket missed"),
	);

	notify(source, missed);
	await until(() => rendered("Clip the socket missed"));
	await until(() =>
		feed
			.messages()
			.some(
				(message) =>
					message.rkey === missed.rkey && message.attachments.length === 1,
			),
	);
	await until(() => tileIn("Clip the socket missed"));

	expect(around).toEqual([missed.rkey]);
});

it("skips the refetch when the live create follows the notification", async () => {
	let calls: ReturnType<typeof countAround> | undefined;
	const { store, source } = await mountWith((source) => {
		calls = countAround(source);
	});
	calls?.arm();
	const around = calls?.around ?? [];
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	const message = await withVideo(
		foreign(source, feed.channel, other, "Clip delivered live"),
	);

	notify(source, message);
	deliver(source, message);
	await until(() => tileIn("Clip delivered live"));
	await wait(2500);

	expect(around).toEqual([]);
});

it("keeps the notified copy when the refetch fails", async () => {
	let calls: ReturnType<typeof countAround> | undefined;
	const { store, source } = await mountWith((source) => {
		calls = countAround(source, true);
	});
	calls?.arm();
	const around = calls?.around ?? [];
	const feed = devFeed(store);
	const other = otherAuthor(feed, source.world.viewerDid);
	const missed = await withVideo(
		foreign(source, feed.channel, other, "Clip that fails to load"),
	);

	notify(source, missed);
	await until(() => around.length === 1);
	await wait(300);

	expect(rendered("Clip that fails to load")).toBe(true);
	expect(
		feed.messages().find((message) => message.rkey === missed.rkey)
			?.attachments,
	).toEqual([]);
});
