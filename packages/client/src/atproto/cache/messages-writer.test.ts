import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LabelEventFrame, MessageEventFrame } from "../sync-frames";
import type { MessageView } from "../views";
import { rkeyOf } from "./messages-snapshot";
import {
	applyLabelEvent,
	applyMessageEvent,
	configureSnapshotWriter,
	flushSnapshotWriter,
	foldLabelEvent,
	foldMessageEvent,
	isOpenChannel,
	offerSnapshotWindow,
	registerOpenChannel,
	resetSnapshotWriter,
} from "./messages-writer";
import type { MessagesSnapshot } from "./schema";

const DID = "did:plc:abc123";
const OTHER_DID = "did:plc:xyz789";
const CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/general`;

const author = {
	did: DID,
	handle: "someone.example",
	displayName: "Someone",
	isBot: false,
	syncBluesky: false,
} as unknown as MessageView["author"];

const message = (
	rkey: string,
	text = "hello",
	createdAt = "2026-01-01T00:00:00.000Z",
	did = DID,
): MessageView =>
	({
		uri: `${CHANNEL}/social.colibri.beta.message/${rkey}`,
		rkey,
		channel: CHANNEL,
		text,
		facets: [],
		author: did === DID ? author : { ...author, did },
		attachments: [],
		reactions: [],
		labels: [],
		createdAt,
	}) as unknown as MessageView;

const snapshot = (
	messages: MessageView[],
	hasMore?: boolean,
	space = CHANNEL,
): MessagesSnapshot => ({
	space,
	messages,
	hasMore,
	ts: 1,
});

const create = (
	rkey: string,
	text = "hello",
	createdAt = "2026-01-01T00:00:00.000Z",
): MessageEventFrame =>
	({
		$type: "social.colibri.beta.sync.defs#messageEvent",
		event: "create",
		channel: CHANNEL,
		message: message(rkey, text, createdAt),
	}) as unknown as MessageEventFrame;

const update = (rkey: string, text: string): MessageEventFrame =>
	({
		$type: "social.colibri.beta.sync.defs#messageEvent",
		event: "update",
		channel: CHANNEL,
		message: message(rkey, text),
	}) as unknown as MessageEventFrame;

const remove = (rkey: string, did = DID): MessageEventFrame =>
	({
		$type: "social.colibri.beta.sync.defs#messageEvent",
		event: "delete",
		channel: CHANNEL,
		subject: { did, rkey },
	}) as unknown as MessageEventFrame;

const labelEvent = (
	event: "create" | "negate",
	val: string,
	rkey: string,
	did = DID,
): LabelEventFrame =>
	({
		$type: "social.colibri.beta.sync.defs#labelEvent",
		event,
		space: CHANNEL,
		subject: { did, collection: "social.colibri.beta.message", rkey },
		val,
		src: DID,
	}) as unknown as LabelEventFrame;

describe("applyLabelEvent", () => {
	it("drops a message a hidden label was applied to", () => {
		const next = applyLabelEvent(
			snapshot([message("a"), message("b")]),
			labelEvent("create", "hidden", "b"),
		);
		expect(next?.messages.map((m) => m.rkey)).toEqual(["a"]);
	});

	it("keeps a message from a different author sharing the same rkey", () => {
		const mine = message("a", "hello", "2026-01-01T00:00:00.000Z", DID);
		const theirs = message("a", "hello", "2026-01-01T00:00:00.000Z", OTHER_DID);
		const next = applyLabelEvent(
			snapshot([mine, theirs]),
			labelEvent("create", "hidden", "a", OTHER_DID),
		);
		expect(next?.messages).toEqual([mine]);
	});

	it("moves the cursor to the oldest remaining message", () => {
		const next = applyLabelEvent(
			snapshot([message("a"), message("b")]),
			labelEvent("create", "hidden", "a"),
		);
		expect(next?.cursor).toBe("b");
	});

	it("ignores a display-hint label", () => {
		expect(
			applyLabelEvent(
				snapshot([message("a")]),
				labelEvent("create", "spoiler", "a"),
			),
		).toBeUndefined();
	});

	it("ignores a hidden negate, since a messageEvent republishes the message", () => {
		expect(
			applyLabelEvent(
				snapshot([message("a")]),
				labelEvent("negate", "hidden", "a"),
			),
		).toBeUndefined();
	});

	it("reports no change when the subject is outside the cached window", () => {
		expect(
			applyLabelEvent(
				snapshot([message("a")]),
				labelEvent("create", "hidden", "zzz"),
			),
		).toBeUndefined();
	});
});

describe("applyMessageEvent", () => {
	it("appends a new message", () => {
		const next = applyMessageEvent(snapshot([message("a")]), create("b"), 50);
		expect(next?.messages.map((m) => m.text)).toEqual(["hello", "hello"]);
		expect(next?.messages[1]?.rkey).toBe("b");
	});

	it("keeps a message moved in from another space", () => {
		const moved = {
			...message("b"),
			channel: `at://${DID}/space/social.colibri.beta.channel.text/other`,
		} as MessageView;
		const frame = {
			$type: "social.colibri.beta.sync.defs#messageEvent",
			event: "create",
			channel: CHANNEL,
			message: moved,
		} as unknown as MessageEventFrame;
		const next = applyMessageEvent(snapshot([message("a")]), frame, 50);
		expect((next?.messages ?? []).map((m) => m.rkey)).toEqual(["a", "b"]);
	});

	it("edits in place rather than appending a duplicate", () => {
		const next = applyMessageEvent(
			snapshot([message("a"), message("b")]),
			update("b", "edited"),
			50,
		);
		expect(next?.messages).toHaveLength(2);
		expect(next?.messages[1]?.text).toBe("edited");
	});

	it("ignores an update for a message outside the cached window", () => {
		expect(
			applyMessageEvent(snapshot([message("a")]), update("zzz", "edited"), 50),
		).toBeUndefined();
	});

	it("removes a deleted message by its RecordRef, not by uri", () => {
		const next = applyMessageEvent(
			snapshot([message("a"), message("b")]),
			remove("b"),
			50,
		);
		expect(next?.messages.map((m) => m.rkey)).toEqual(["a"]);
	});

	it("does not delete a message from a different author sharing the same rkey", () => {
		const mine = message("a", "hello", "2026-01-01T00:00:00.000Z", DID);
		const theirs = message("a", "hello", "2026-01-01T00:00:00.000Z", OTHER_DID);
		const next = applyMessageEvent(
			snapshot([mine, theirs]),
			remove("a", OTHER_DID),
			50,
		);
		expect(next?.messages).toEqual([mine]);
	});

	it("reports no change when the delete has no matching message", () => {
		expect(
			applyMessageEvent(snapshot([message("a")]), remove("zzz"), 50),
		).toBeUndefined();
	});

	it("reports no change when a delete event carries no subject", () => {
		const malformed = {
			$type: "social.colibri.beta.sync.defs#messageEvent",
			event: "delete",
			channel: CHANNEL,
		} as unknown as MessageEventFrame;
		expect(
			applyMessageEvent(snapshot([message("a")]), malformed, 50),
		).toBeUndefined();
	});

	it("trims to the page size, keeping the newest rows", () => {
		const next = applyMessageEvent(
			snapshot([message("a"), message("b"), message("c")]),
			create("d"),
			3,
		);
		expect(next?.messages.map((m) => m.rkey)).toEqual(["b", "c", "d"]);
	});

	it("splices a replayed message into date order instead of appending it", () => {
		const next = applyMessageEvent(
			snapshot([
				message("a", "hello", "2026-01-01T00:00:00.000Z"),
				message("c", "hello", "2026-01-03T00:00:00.000Z"),
			]),
			create("b", "hello", "2026-01-02T00:00:00.000Z"),
			50,
		);
		expect(next?.messages.map((m) => m.rkey)).toEqual(["a", "b", "c"]);
	});

	it("ignores a replayed message older than the snapshot window", () => {
		expect(
			applyMessageEvent(
				snapshot([message("b", "hello", "2026-01-02T00:00:00.000Z")], true),
				create("a", "hello", "2026-01-01T00:00:00.000Z"),
				50,
			),
		).toBeUndefined();
	});

	it("keeps a message older than the window when the whole channel is loaded", () => {
		const next = applyMessageEvent(
			snapshot([message("b", "hello", "2026-01-02T00:00:00.000Z")], false),
			create("a", "hello", "2026-01-01T00:00:00.000Z"),
			50,
		);
		expect(next?.messages.map((m) => m.rkey)).toEqual(["a", "b"]);
	});

	it("refreshes `ts` so an updated snapshot stays ahead in the LRU", () => {
		const next = applyMessageEvent(snapshot([message("a")]), create("b"), 50);
		expect(next?.ts).toBeGreaterThan(1);
	});
});

describe("registerOpenChannel", () => {
	it("reports the claimed channel as owned", () => {
		registerOpenChannel(CHANNEL);
		expect(isOpenChannel(CHANNEL)).toBe(true);
		expect(isOpenChannel(`${CHANNEL}-other`)).toBe(false);
	});

	it("releases ownership", () => {
		registerOpenChannel(CHANNEL);
		registerOpenChannel(undefined);
		expect(isOpenChannel(CHANNEL)).toBe(false);
	});

	it("treats an empty space as no claim", () => {
		registerOpenChannel("");
		expect(isOpenChannel("")).toBe(false);
	});
});

describe("the background snapshot queue", () => {
	const NS = "appview:did:plc:me";
	const OTHER = `at://${DID}/space/social.colibri.beta.channel.text/random`;

	let stored: Map<string, MessagesSnapshot>;
	let writes: Array<{ space: string; snapshot: MessagesSnapshot }>;
	let errors: unknown[];

	const configure = () => {
		configureSnapshotWriter({
			namespace: () => NS,
			read: (ns, space) => Promise.resolve(stored.get(`${ns}:${space}`)),
			write: (ns, space, snap) => {
				writes.push({ space, snapshot: snap });
				stored.set(`${ns}:${space}`, snap);
				return Promise.resolve();
			},
			onError: (err) => {
				errors.push(err);
			},
		});
	};

	const seed = (space: string, messages: MessageView[]) => {
		stored.set(`${NS}:${space}`, snapshot(messages));
	};

	const settle = () =>
		new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});

	const offer = (space: string, messages: MessageView[]) => {
		offerSnapshotWindow(space, messages, {
			readCursor: undefined,
			hasMore: false,
			limit: 50,
		});
	};

	const rkeys = (messages: MessageView[]) => messages.map((m) => m.rkey);

	const inChannel = (rkey: string, space: string): MessageView =>
		({ ...message(rkey), channel: space }) as unknown as MessageView;

	const foreign = (rkey: string) => inChannel(rkey, OTHER);

	beforeEach(() => {
		stored = new Map();
		writes = [];
		errors = [];
		registerOpenChannel(undefined);
		resetSnapshotWriter();
	});

	afterEach(() => {
		resetSnapshotWriter();
		registerOpenChannel(undefined);
	});

	it("ignores a window offered before the writer is configured", async () => {
		offer(CHANNEL, [message("a")]);
		await settle();
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("ignores a window offered after the writer is reset", async () => {
		configure();
		resetSnapshotWriter();

		offer(CHANNEL, [message("a")]);
		await settle();
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("drops a window for the channel that is currently open", async () => {
		configure();
		registerOpenChannel(CHANNEL);

		offer(CHANNEL, [message("a")]);
		await settle();
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("stores a window for a channel with nothing cached", async () => {
		configure();

		offer(CHANNEL, [message("a"), message("b")]);
		await settle();
		flushSnapshotWriter();

		expect(writes).toHaveLength(1);
		expect(writes[0]?.space).toBe(CHANNEL);
		expect(rkeys(writes[0]?.snapshot.messages ?? [])).toEqual(["a", "b"]);
	});

	it("folds a hidden label into a background channel's snapshot", async () => {
		configure();
		seed(CHANNEL, [message("a"), message("b")]);

		foldLabelEvent(labelEvent("create", "hidden", "b"));
		await settle();
		flushSnapshotWriter();

		expect(rkeys(writes[0]?.snapshot.messages ?? [])).toEqual(["a"]);
		expect(errors).toEqual([]);
	});

	it("leaves the open channel's snapshot to the channel itself on a label", async () => {
		configure();
		seed(CHANNEL, [message("a"), message("b")]);
		registerOpenChannel(CHANNEL);

		foldLabelEvent(labelEvent("create", "hidden", "b"));
		await settle();
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("keeps a folded event when a window lands for the same channel", async () => {
		configure();
		seed(CHANNEL, [message("a")]);

		foldMessageEvent(create("b"), 50);
		offer(CHANNEL, [message("a")]);
		await settle();
		flushSnapshotWriter();

		expect(writes).toHaveLength(1);
		expect(rkeys(writes[0]?.snapshot.messages ?? [])).toEqual(["a", "b"]);
		expect(errors).toEqual([]);
	});

	it("writes one snapshot per channel and clears what it flushed", async () => {
		configure();

		offer(CHANNEL, [message("a")]);
		offer(OTHER, [inChannel("b", OTHER)]);
		await settle();
		flushSnapshotWriter();

		expect(writes.map((w) => w.space).sort()).toEqual([CHANNEL, OTHER].sort());

		writes.length = 0;
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("skips a channel that became open before the flush", async () => {
		configure();

		offer(CHANNEL, [message("a")]);
		offer(OTHER, [inChannel("b", OTHER)]);
		await settle();
		registerOpenChannel(CHANNEL);
		flushSnapshotWriter();

		expect(writes.map((w) => w.space)).toEqual([OTHER]);
	});

	it("replaces a stored snapshot stamped with another channel", async () => {
		configure();
		stored.set(`${NS}:${CHANNEL}`, snapshot([message("z")], false, OTHER));

		offer(CHANNEL, [message("a")]);
		await settle();
		flushSnapshotWriter();

		expect(writes).toHaveLength(1);
		expect(rkeys(writes[0]?.snapshot.messages ?? [])).toEqual(["a"]);
	});

	it("keeps a moved-in message in an offered window", async () => {
		configure();

		offer(CHANNEL, [message("a"), foreign("z")]);
		await settle();
		flushSnapshotWriter();

		expect(rkeys(writes[0]?.snapshot.messages ?? [])).toEqual(["a", "z"]);
		expect(writes[0]?.snapshot.space).toBe(CHANNEL);
	});

	it("ignores an empty offered window", async () => {
		configure();

		offer(CHANNEL, []);
		await settle();
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("refuses to fold an event into a snapshot stamped elsewhere", async () => {
		configure();
		stored.set(`${NS}:${CHANNEL}`, snapshot([message("z")], false, OTHER));

		foldMessageEvent(create("b"), 50);
		await settle();
		flushSnapshotWriter();

		expect(writes).toEqual([]);
	});

	it("reports a read failure through onError instead of throwing", async () => {
		configureSnapshotWriter({
			namespace: () => NS,
			read: () => Promise.reject(new Error("indexeddb is gone")),
			write: () => Promise.resolve(),
			onError: (err) => {
				errors.push(err);
			},
		});

		offer(CHANNEL, [message("a")]);
		await settle();

		expect(errors).toHaveLength(1);
	});
});

describe("rkeyOf re-export sanity", () => {
	it("still extracts the rkey from a message uri", () => {
		expect(rkeyOf(message("a").uri)).toBe("a");
	});
});
