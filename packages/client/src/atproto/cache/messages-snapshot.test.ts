import { describe, expect, it } from "vitest";
import type {
	Message,
	PendingMessage,
} from "../xrpc/social/colibri/channel/listMessages";
import {
	belongsToChannel,
	buildMessagesSnapshot,
	cursorFor,
	isSnapshotPaintable,
	isSnapshotStale,
	MESSAGES_HARD_TTL_MS,
	MESSAGES_STALE_HINT_MS,
	mergeSnapshotWindow,
	reconcileFetchedWindow,
	restoreMessagesSnapshot,
	rkeyOf,
	shouldWriteSnapshot,
	snapshotAgeMs,
	snapshotBelongsTo,
} from "./messages-snapshot";
import type { MessagesSnapshot } from "./schema";

const DID = "did:plc:abc123";
const CHANNEL = `at://${DID}/social.colibri.channel/general`;
const COMMUNITY = `at://${DID}/social.colibri.community/self`;

const author = {
	did: DID,
	handle: "someone.example",
	data: { displayName: "Someone" },
} as unknown as Message["author"];

const message = (rkey: string): Message => ({
	uri: `at://${DID}/social.colibri.message/${rkey}`,
	text: "hello",
	facets: [],
	channel: CHANNEL,
	community: COMMUNITY,
	author,
	attachments: [],
	reactions: [],
	createdAt: "2026-01-01T00:00:00.000Z",
	edited: false,
});

const run = (count: number, from = 0): Message[] =>
	Array.from({ length: count }, (_, i) => message(`m${from + i}`));

const options = (
	overrides?: Partial<Parameters<typeof buildMessagesSnapshot>[1]>,
) => ({
	readCursor: undefined,
	hasMore: true,
	limit: 50,
	now: 1234,
	...overrides,
});

describe("rkeyOf", () => {
	it("returns the last path segment of an AT URI", () => {
		expect(rkeyOf(`at://${DID}/social.colibri.message/abc`)).toBe("abc");
	});

	it("returns an empty string for an empty input", () => {
		expect(rkeyOf("")).toBe("");
	});
});

describe("cursorFor", () => {
	it("derives the cursor from the oldest message", () => {
		expect(cursorFor(run(3))).toBe("m0");
	});

	it("falls back when there are no messages", () => {
		expect(cursorFor([], "kept")).toBe("kept");
		expect(cursorFor([])).toBeUndefined();
	});
});

describe("buildMessagesSnapshot", () => {
	it("keeps the newest page and stamps the cursor from it", () => {
		const snap = buildMessagesSnapshot(run(60), options());

		expect(snap.messages).toHaveLength(50);
		expect(snap.messages[0]?.uri).toContain("m10");
		expect(snap.cursor).toBe("m10");
	});

	it("forces hasMore when the snapshot was truncated", () => {
		const snap = buildMessagesSnapshot(run(60), options({ hasMore: false }));

		expect(snap.hasMore).toBe(true);
	});

	it("carries hasMore through when nothing was dropped", () => {
		const snap = buildMessagesSnapshot(run(10), options({ hasMore: false }));

		expect(snap.messages).toHaveLength(10);
		expect(snap.hasMore).toBe(false);
		expect(snap.cursor).toBe("m0");
	});

	it("records the read cursor and timestamp verbatim", () => {
		const snap = buildMessagesSnapshot(
			run(3),
			options({ readCursor: "cursor-uri", now: 999 }),
		);

		expect(snap.readCursor).toBe("cursor-uri");
		expect(snap.ts).toBe(999);
	});

	it("produces an empty snapshot without a cursor", () => {
		const snap = buildMessagesSnapshot([], options());

		expect(snap.messages).toEqual([]);
		expect(snap.cursor).toBeUndefined();
	});
});

describe("restoreMessagesSnapshot", () => {
	it("prefers the persisted cursor and hasMore", () => {
		const snap: MessagesSnapshot = {
			messages: run(3),
			cursor: "persisted",
			hasMore: false,
			ts: 1,
		};

		expect(restoreMessagesSnapshot(snap)).toEqual({
			cursor: "persisted",
			hasMore: false,
		});
	});

	it("derives the cursor from a snapshot written before the fields existed", () => {
		const snap: MessagesSnapshot = { messages: run(3), ts: 1 };

		expect(restoreMessagesSnapshot(snap)).toEqual({
			cursor: "m0",
			hasMore: undefined,
		});
	});

	it("round-trips a built snapshot", () => {
		const built = buildMessagesSnapshot(run(10), options({ hasMore: false }));

		expect(restoreMessagesSnapshot(built)).toEqual({
			cursor: "m0",
			hasMore: false,
		});
	});
});

describe("snapshotAgeMs", () => {
	it("measures the snapshot against the supplied clock", () => {
		expect(snapshotAgeMs({ messages: [], ts: 1000 }, 4000)).toBe(3000);
	});
});

describe("isSnapshotPaintable", () => {
	it("paints a fresh snapshot", () => {
		expect(isSnapshotPaintable(0)).toBe(true);
		expect(isSnapshotPaintable(60_000)).toBe(true);
	});

	it("paints a snapshot exactly at the hard TTL", () => {
		expect(isSnapshotPaintable(MESSAGES_HARD_TTL_MS)).toBe(true);
	});

	it("refuses a snapshot past the hard TTL", () => {
		expect(isSnapshotPaintable(MESSAGES_HARD_TTL_MS + 1)).toBe(false);
	});

	it("refuses a snapshot stamped in the future", () => {
		expect(isSnapshotPaintable(-1)).toBe(false);
	});
});

describe("isSnapshotStale", () => {
	it("stays quiet for a snapshot within the hint window", () => {
		expect(isSnapshotStale(0)).toBe(false);
		expect(isSnapshotStale(MESSAGES_STALE_HINT_MS)).toBe(false);
	});

	it("flags a snapshot past the hint window", () => {
		expect(isSnapshotStale(MESSAGES_STALE_HINT_MS + 1)).toBe(true);
	});

	it("stays quiet when there is no snapshot", () => {
		expect(isSnapshotStale(undefined)).toBe(false);
	});
});

describe("shouldWriteSnapshot", () => {
	const gate = {
		cacheEnabled: true,
		channelUri: CHANNEL,
		hydratedFromNetwork: true,
		appliedRemoval: false,
	};

	it("allows a write once the network has hydrated the channel", () => {
		expect(shouldWriteSnapshot(gate)).toBe(true);
	});

	it("blocks a write that would only persist a cache paint", () => {
		expect(shouldWriteSnapshot({ ...gate, hydratedFromNetwork: false })).toBe(
			false,
		);
	});

	it("allows a removal applied on top of a cache paint to persist", () => {
		expect(
			shouldWriteSnapshot({
				...gate,
				hydratedFromNetwork: false,
				appliedRemoval: true,
			}),
		).toBe(true);
	});

	it("blocks a write when the cache is disabled", () => {
		expect(shouldWriteSnapshot({ ...gate, cacheEnabled: false })).toBe(false);
	});

	it("blocks a write without a channel", () => {
		expect(shouldWriteSnapshot({ ...gate, channelUri: "" })).toBe(false);
	});
});

describe("reconcileFetchedWindow", () => {
	const pending = (hash: string): PendingMessage =>
		({ ...message(`pending-${hash}`), hash }) as unknown as PendingMessage;

	const prunableOf = (
		local: ReadonlyArray<Message | PendingMessage>,
	): ReadonlySet<string> => new Set(local.map((m) => m.uri));

	const uris = (local: ReadonlyArray<Message | PendingMessage>): string[] =>
		local.map((m) => m.uri);

	const reconcile = (
		local: (Message | PendingMessage)[],
		fetched: Message[],
		pageSize = 3,
	) =>
		reconcileFetchedWindow(local, fetched, {
			pageSize,
			prunable: prunableOf(local),
		});

	it("drops a message the server no longer returns", () => {
		const [a, b, c] = [message("a"), message("b"), message("c")];
		expect(uris(reconcile([a, b, c], [a, c]) ?? [])).toEqual(uris([a, c]));
	});

	it("reports no change when the server returned everything held", () => {
		const [a, b] = [message("a"), message("b")];
		expect(reconcile([a, b], [a, b])).toBeUndefined();
	});

	it("keeps pending rows the server cannot know about yet", () => {
		const [a, queued] = [message("a"), pending("h1")];
		expect(reconcile([a, queued], [a])).toBeUndefined();
	});

	it("keeps history older than a full page", () => {
		const [old, b, c, d] = [
			message("a"),
			message("b"),
			message("c"),
			message("d"),
		];
		expect(reconcile([old, b, c, d], [b, c, d], 3)).toBeUndefined();
	});

	it("drops history the server proves is gone on a short page", () => {
		const [old, b, c] = [message("a"), message("b"), message("c")];
		expect(uris(reconcile([old, b, c], [b, c], 3) ?? [])).toEqual(uris([b, c]));
	});

	it("drops every confirmed message when the channel came back empty", () => {
		const [a, queued] = [message("a"), pending("h1")];
		expect(uris(reconcile([a, queued], []) ?? [])).toEqual(uris([queued]));
	});

	it("keeps a message that arrived while the request was in flight", () => {
		const [a, b] = [message("a"), message("b")];
		const raced = message("c");
		expect(
			reconcileFetchedWindow([a, b, raced], [a, b], {
				pageSize: 3,
				prunable: prunableOf([a, b]),
			}),
		).toBeUndefined();
	});

	it("drops the newest message when that is the one that was deleted", () => {
		const [a, b] = [message("a"), message("b")];
		expect(uris(reconcile([a, b], [a]) ?? [])).toEqual(uris([a]));
	});

	it("still drops a deleted message when another raced in", () => {
		const [a, b] = [message("a"), message("b")];
		const raced = message("c");
		expect(
			uris(
				reconcileFetchedWindow([a, b, raced], [a], {
					pageSize: 3,
					prunable: prunableOf([a, b]),
				}) ?? [],
			),
		).toEqual(uris([a, raced]));
	});
});

describe("mergeSnapshotWindow", () => {
	const named = (rkey: string, text: string): Message => ({
		...message(rkey),
		text,
	});

	const window = (rkeys: string[]): Message[] => rkeys.map((r) => message(r));

	const snapshot = (
		messages: Message[],
		overrides?: Partial<MessagesSnapshot>,
	): MessagesSnapshot => ({
		messages,
		cursor: messages[0] ? rkeyOf(messages[0].uri) : undefined,
		hasMore: false,
		ts: 1,
		...overrides,
	});

	it("falls back to a plain build when nothing is stored", () => {
		const fetched = window(["m01", "m02"]);

		expect(mergeSnapshotWindow(undefined, fetched, options())).toEqual(
			buildMessagesSnapshot(fetched, options()),
		);
	});

	it("dedupes by uri with the fetched copy winning, in rkey order", () => {
		const existing = snapshot([named("m01", "stale"), named("m02", "stale")]);
		const fetched = [named("m02", "fresh"), named("m03", "fresh")];

		const merged = mergeSnapshotWindow(existing, fetched, options());

		expect(merged.messages.map((m) => rkeyOf(m.uri))).toEqual([
			"m01",
			"m02",
			"m03",
		]);
		expect(merged.messages.map((m) => m.text)).toEqual([
			"stale",
			"fresh",
			"fresh",
		]);
	});

	it("keeps a message the writer folded in while the fetch was in flight", () => {
		const existing = snapshot(window(["m01", "m02", "m03"]));
		const fetched = window(["m01", "m02"]);

		const merged = mergeSnapshotWindow(existing, fetched, options());

		expect(merged.messages.map((m) => rkeyOf(m.uri))).toContain("m03");
	});

	it("keeps only the newest window and reports more when it truncates", () => {
		const existing = snapshot(window(["m01", "m02"]));
		const fetched = window(["m03", "m04"]);

		const merged = mergeSnapshotWindow(
			existing,
			fetched,
			options({ limit: 3, hasMore: false }),
		);

		expect(merged.messages.map((m) => rkeyOf(m.uri))).toEqual([
			"m02",
			"m03",
			"m04",
		]);
		expect(merged.hasMore).toBe(true);
		expect(merged.cursor).toBe("m02");
	});

	it("stamps the merge with the supplied clock", () => {
		const existing = snapshot(window(["m01"]));

		const merged = mergeSnapshotWindow(
			existing,
			window(["m02"]),
			options({ now: 999 }),
		);

		expect(merged.ts).toBe(999);
	});

	it("keeps the stored read cursor when the fetched view has none", () => {
		const existing = snapshot(window(["m01"]), { readCursor: "m01" });

		const merged = mergeSnapshotWindow(existing, window(["m02"]), options());

		expect(merged.readCursor).toBe("m01");
	});

	it("prefers the fetched read cursor when there is one", () => {
		const existing = snapshot(window(["m01"]), { readCursor: "m01" });

		const merged = mergeSnapshotWindow(
			existing,
			window(["m02"]),
			options({ readCursor: "m02" }),
		);

		expect(merged.readCursor).toBe("m02");
	});
});

describe("snapshotBelongsTo", () => {
	const OTHER = `at://${DID}/social.colibri.channel/random`;

	const stored = (messages: Message[]): MessagesSnapshot => ({
		messages,
		ts: 1,
	});

	it("accepts a snapshot whose messages all name the channel", () => {
		expect(snapshotBelongsTo(stored(run(3)), CHANNEL)).toBe(true);
	});

	it("rejects a snapshot written under another channel's key", () => {
		expect(snapshotBelongsTo(stored(run(3)), OTHER)).toBe(false);
	});

	it("rejects a snapshot with even one foreign message", () => {
		const mixed = [...run(2), { ...message("m9"), channel: OTHER }];

		expect(snapshotBelongsTo(stored(mixed), CHANNEL)).toBe(false);
	});

	it("accepts an empty snapshot", () => {
		expect(snapshotBelongsTo(stored([]), CHANNEL)).toBe(true);
	});

	it("gives a message with no channel the benefit of the doubt", () => {
		const anonymous = { ...message("m0"), channel: "" };

		expect(belongsToChannel(anonymous, CHANNEL)).toBe(true);
		expect(snapshotBelongsTo(stored([anonymous]), CHANNEL)).toBe(true);
	});
});
