import { describe, expect, it } from "vitest";
import type {
	Message,
	PendingMessage,
} from "../xrpc/social/colibri/channel/listMessages";
import type { QueuedRecord } from "./outbox";
import { rehydrateQueuedMessages } from "./rehydrate";

const DID = "did:plc:abc123";
const CHANNEL = `at://${DID}/social.colibri.channel/general`;
const OTHER_CHANNEL = `at://${DID}/social.colibri.channel/random`;
const COMMUNITY = `at://${DID}/social.colibri.community/self`;

const author = {
	did: DID,
	handle: "someone.example",
	data: { displayName: "Someone" },
} as unknown as Message["author"];

const message = (rkey: string, text = "hello"): Message => ({
	uri: `at://${DID}/social.colibri.message/${rkey}`,
	text,
	facets: [],
	channel: CHANNEL,
	community: COMMUNITY,
	author,
	attachments: [],
	reactions: [],
	createdAt: "2026-01-01T00:00:00.000Z",
	edited: false,
});

const queued = (
	rkey: string,
	kind: "create" | "put",
	record: Record<string, unknown>,
	createdAt = 1,
): QueuedRecord => ({
	uri: `at://${DID}/social.colibri.message/${rkey}`,
	rkey,
	kind,
	record: { channel: CHANNEL, ...record },
	createdAt,
});

const run = (
	queuedRecords: QueuedRecord[],
	existing: (Message | PendingMessage)[],
) =>
	rehydrateQueuedMessages({
		channelUri: CHANNEL,
		community: COMMUNITY,
		author,
		queued: queuedRecords,
		existing,
	});

describe("rehydrateQueuedMessages", () => {
	it("appends a queued create that never reached the list", () => {
		const result = run(
			[queued("m2", "create", { text: "unsent", createdAt: "2026-01-02" })],
			[message("m1")],
		);

		expect(result).toHaveLength(2);
		const added = result?.[1] as PendingMessage;
		expect(added.text).toBe("unsent");
		expect(added.hash).toBe("outbox:m2");
		expect(added.community).toBe(COMMUNITY);
		expect(added.channel).toBe(CHANNEL);
	});

	it("ignores queued writes for another channel", () => {
		const entry = queued("m2", "create", { text: "elsewhere" });
		entry.record.channel = OTHER_CHANNEL;

		expect(run([entry], [message("m1")])).toBeUndefined();
	});

	it("does not duplicate a create already present in the list", () => {
		expect(
			run([queued("m1", "create", { text: "hello" })], [message("m1")]),
		).toBeUndefined();
	});

	it("orders multiple additions by their queue timestamp", () => {
		const result = run(
			[
				queued("m3", "create", { text: "second" }, 20),
				queued("m2", "create", { text: "first" }, 10),
			],
			[],
		);

		expect(result?.map((m) => m.text)).toEqual(["first", "second"]);
	});

	it("resolves a reply parent from the existing list", () => {
		const parent = message("m1");
		const result = run(
			[queued("m2", "create", { text: "reply", parent: parent.uri })],
			[parent],
		);

		expect((result?.[1] as PendingMessage).parent?.uri).toBe(parent.uri);
	});

	it("leaves the parent undefined when it is not loaded", () => {
		const result = run(
			[
				queued("m2", "create", {
					text: "reply",
					parent: `at://${DID}/social.colibri.message/gone`,
				}),
			],
			[],
		);

		expect((result?.[0] as PendingMessage).parent).toBeUndefined();
	});

	it("applies a queued edit over the confirmed row", () => {
		const result = run(
			[queued("m1", "put", { text: "edited" })],
			[message("m1")],
		);

		expect(result?.[0]?.text).toBe("edited");
		expect(result?.[0]?.edited).toBe(true);
		expect("hash" in (result?.[0] ?? {})).toBe(false);
	});

	it("ignores a queued edit for a message that is not loaded", () => {
		expect(
			run([queued("m9", "put", { text: "edited" })], [message("m1")]),
		).toBeUndefined();
	});

	it("converges so a second pass reports no further change", () => {
		const first = run(
			[
				queued("m1", "put", { text: "edited" }),
				queued("m2", "create", { text: "unsent" }),
			],
			[message("m1")],
		);
		expect(first).toBeDefined();

		const second = run(
			[
				queued("m1", "put", { text: "edited" }),
				queued("m2", "create", { text: "unsent" }),
			],
			first ?? [],
		);

		expect(second).toBeUndefined();
	});

	it("returns undefined when nothing is queued", () => {
		expect(run([], [message("m1")])).toBeUndefined();
	});

	it("tolerates a record with missing fields", () => {
		const result = run([queued("m2", "create", {})], []);

		expect(result?.[0]?.text).toBe("");
		expect(result?.[0]?.facets).toEqual([]);
		expect(result?.[0]?.attachments).toEqual([]);
	});
});
