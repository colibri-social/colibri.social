import type { Colibri_MessageEvent } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import type { Message } from "../xrpc/social/colibri/channel/listMessages";
import {
	applyMessageEvent,
	isOpenChannel,
	registerOpenChannel,
} from "./messages-writer";
import type { MessagesSnapshot } from "./schema";

const DID = "did:plc:abc123";
const CHANNEL = `at://${DID}/social.colibri.channel/general`;
const COMMUNITY = `at://${DID}/social.colibri.community/self`;

const author = {
	did: DID,
	handle: "someone.example",
	data: { displayName: "Someone" },
} as unknown as Message["author"];

const DEFAULT_CREATED_AT = "2026-01-01T00:00:00.000Z";

const message = (
	rkey: string,
	text = "hello",
	createdAt = DEFAULT_CREATED_AT,
): Message => ({
	uri: `at://${DID}/social.colibri.message/${rkey}`,
	text,
	facets: [],
	channel: CHANNEL,
	community: COMMUNITY,
	author,
	attachments: [],
	reactions: [],
	createdAt,
	edited: false,
});

const snapshot = (
	messages: Message[],
	hasMore?: boolean,
): MessagesSnapshot => ({
	messages,
	hasMore,
	ts: 1,
});

type Event = NonNullable<Colibri_MessageEvent["data"]>;

const upsert = (
	rkey: string,
	text = "hello",
	createdAt = DEFAULT_CREATED_AT,
): Event =>
	({
		event: "upsert",
		uri: `at://${DID}/social.colibri.message/${rkey}`,
		channel: CHANNEL,
		text,
		facets: [],
		createdAt,
		edited: false,
		attachments: [],
		author,
	}) as unknown as Event;

const remove = (rkey: string): Event =>
	({
		event: "delete",
		uri: `at://${DID}/social.colibri.message/${rkey}`,
		channel: CHANNEL,
	}) as unknown as Event;

describe("applyMessageEvent", () => {
	it("appends a new message", () => {
		const next = applyMessageEvent(snapshot([message("a")]), upsert("b"), 50);
		expect(next?.messages.map((m) => m.text)).toEqual(["hello", "hello"]);
		expect(next?.messages[1]?.uri).toContain("/b");
	});

	it("carries `community` over from an existing row", () => {
		const next = applyMessageEvent(snapshot([message("a")]), upsert("b"), 50);
		expect(next?.messages[1]?.community).toBe(COMMUNITY);
	});

	it("skips an event when the snapshot has no row to source `community` from", () => {
		expect(applyMessageEvent(snapshot([]), upsert("b"), 50)).toBeUndefined();
	});

	it("edits in place rather than appending a duplicate", () => {
		const next = applyMessageEvent(
			snapshot([message("a"), message("b")]),
			upsert("b", "edited"),
			50,
		);
		expect(next?.messages).toHaveLength(2);
		expect(next?.messages[1]?.text).toBe("edited");
	});

	it("keeps reactions on an edit, since the event carries none", () => {
		const withReaction = message("b");
		withReaction.reactions = [{ emoji: "👍", count: 1, reactorDIDs: [DID] }];
		const next = applyMessageEvent(
			snapshot([message("a"), withReaction]),
			upsert("b", "edited"),
			50,
		);
		expect(next?.messages[1]?.reactions).toHaveLength(1);
	});

	it("removes a deleted message", () => {
		const next = applyMessageEvent(
			snapshot([message("a"), message("b")]),
			remove("b"),
			50,
		);
		expect(next?.messages.map((m) => m.uri)).toEqual([
			`at://${DID}/social.colibri.message/a`,
		]);
	});

	it("reports no change when the deleted message is not in the snapshot", () => {
		expect(
			applyMessageEvent(snapshot([message("a")]), remove("zzz"), 50),
		).toBeUndefined();
	});

	it("trims to the page size, keeping the newest rows", () => {
		const next = applyMessageEvent(
			snapshot([message("a"), message("b"), message("c")]),
			upsert("d"),
			3,
		);
		expect(next?.messages.map((m) => m.uri.split("/").pop())).toEqual([
			"b",
			"c",
			"d",
		]);
	});

	it("splices a replayed message into date order instead of appending it", () => {
		const next = applyMessageEvent(
			snapshot([
				message("a", "hello", "2026-01-01T00:00:00.000Z"),
				message("c", "hello", "2026-01-03T00:00:00.000Z"),
			]),
			upsert("b", "hello", "2026-01-02T00:00:00.000Z"),
			50,
		);
		expect(next?.messages.map((m) => m.uri.split("/").pop())).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	it("ignores a replayed message older than the snapshot window", () => {
		expect(
			applyMessageEvent(
				snapshot([message("b", "hello", "2026-01-02T00:00:00.000Z")], true),
				upsert("a", "hello", "2026-01-01T00:00:00.000Z"),
				50,
			),
		).toBeUndefined();
	});

	it("keeps a message older than the window when the whole channel is loaded", () => {
		const next = applyMessageEvent(
			snapshot([message("b", "hello", "2026-01-02T00:00:00.000Z")], false),
			upsert("a", "hello", "2026-01-01T00:00:00.000Z"),
			50,
		);
		expect(next?.messages.map((m) => m.uri.split("/").pop())).toEqual([
			"a",
			"b",
		]);
	});

	it("refreshes `ts` so an updated snapshot stays ahead in the LRU", () => {
		const next = applyMessageEvent(snapshot([message("a")]), upsert("b"), 50);
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

	it("treats an empty URI as no claim", () => {
		registerOpenChannel("");
		expect(isOpenChannel("")).toBe(false);
	});
});
