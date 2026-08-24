import { describe, expect, it } from "vitest";
import type { PendingMessage } from "../cache/schema";
import type { MessageView } from "../views";
import type { QueuedRecord } from "./outbox";
import { messageUriFor, rehydrateQueuedMessages } from "./rehydrate";

const DID = "did:plc:abc123";
const CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/general`;
const OTHER_CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/random`;

const author = {
	did: DID,
	handle: "someone.example",
	displayName: "Someone",
} as unknown as MessageView["author"];

const message = (rkey: string, text = "hello"): MessageView => ({
	uri: messageUriFor(DID, rkey),
	rkey,
	channel: CHANNEL,
	author,
	text,
	attachments: [],
	reactions: [],
	labels: [],
	createdAt: "2026-01-01T00:00:00.000Z",
});

const queued = (
	rkey: string,
	kind: "spaceCreate" | "spacePut",
	record: Record<string, unknown>,
	createdAt = 1,
	space: string = CHANNEL,
): QueuedRecord => ({
	uri: `${space}/${DID}/social.colibri.beta.message/${rkey}`,
	rkey,
	kind,
	space,
	record: { $type: "social.colibri.beta.message", ...record },
	createdAt,
});

const run = (
	queuedRecords: QueuedRecord[],
	existing: (MessageView | PendingMessage)[],
) =>
	rehydrateQueuedMessages({
		channelSpace: CHANNEL,
		author,
		queued: queuedRecords,
		existing,
	});

describe("rehydrateQueuedMessages", () => {
	it("appends a queued create that never reached the list", () => {
		const result = run(
			[
				queued("m2", "spaceCreate", {
					text: "unsent",
					createdAt: "2026-01-02",
				}),
			],
			[message("m1")],
		);

		expect(result).toHaveLength(2);
		const added = result?.[1] as PendingMessage;
		expect(added.text).toBe("unsent");
		expect(added.hash).toBe("outbox:m2");
		expect(added.channel).toBe(CHANNEL);
		expect(added.uri).toBe(messageUriFor(DID, "m2"));
	});

	it("addresses the message by author did and rkey rather than a bare rkey", () => {
		const result = run([queued("m2", "spaceCreate", { text: "unsent" })], []);
		const added = result?.[0] as PendingMessage;
		expect(added.uri).toBe(`at://${DID}/social.colibri.beta.message/m2`);
	});

	it("ignores queued writes for another channel space", () => {
		const entry = queued(
			"m2",
			"spaceCreate",
			{ text: "elsewhere" },
			1,
			OTHER_CHANNEL,
		);

		expect(run([entry], [message("m1")])).toBeUndefined();
	});

	it("does not duplicate a create already present in the list", () => {
		expect(
			run([queued("m1", "spaceCreate", { text: "hello" })], [message("m1")]),
		).toBeUndefined();
	});

	it("orders multiple additions by their queue timestamp", () => {
		const result = run(
			[
				queued("m3", "spaceCreate", { text: "second" }, 20),
				queued("m2", "spaceCreate", { text: "first" }, 10),
			],
			[],
		);

		expect(result?.map((m) => m.text)).toEqual(["first", "second"]);
	});

	it("applies a queued edit over the confirmed row, using updatedAt rather than an edited flag", () => {
		const result = run(
			[
				queued("m1", "spacePut", {
					text: "edited",
					updatedAt: "2026-01-03T00:00:00.000Z",
				}),
			],
			[message("m1")],
		);

		expect(result?.[0]?.text).toBe("edited");
		expect((result?.[0] as MessageView).updatedAt).toBe(
			"2026-01-03T00:00:00.000Z",
		);
		expect("hash" in (result?.[0] ?? {})).toBe(false);
	});

	it("ignores a queued edit for a message that is not loaded", () => {
		expect(
			run([queued("m9", "spacePut", { text: "edited" })], [message("m1")]),
		).toBeUndefined();
	});

	it("converges so a second pass reports no further change", () => {
		const first = run(
			[
				queued("m1", "spacePut", {
					text: "edited",
					updatedAt: "2026-01-03T00:00:00.000Z",
				}),
				queued("m2", "spaceCreate", { text: "unsent" }),
			],
			[message("m1")],
		);
		expect(first).toBeDefined();

		const second = run(
			[
				queued("m1", "spacePut", {
					text: "edited",
					updatedAt: "2026-01-03T00:00:00.000Z",
				}),
				queued("m2", "spaceCreate", { text: "unsent" }),
			],
			first ?? [],
		);

		expect(second).toBeUndefined();
	});

	it("returns undefined when nothing is queued", () => {
		expect(run([], [message("m1")])).toBeUndefined();
	});

	it("tolerates a record with missing fields", () => {
		const result = run([queued("m2", "spaceCreate", {})], []);

		expect(result?.[0]?.text).toBe("");
		expect(result?.[0]?.facets).toEqual([]);
		expect(result?.[0]?.attachments).toEqual([]);
	});

	it("resolves a queued reply's parent from the visible list", () => {
		const parent = message("m1", "the original");
		const result = run(
			[
				queued("m2", "spaceCreate", {
					text: "unsent reply",
					parent: { did: DID, rkey: "m1" },
				}),
			],
			[parent],
		);

		expect(result?.[1]?.parent).toEqual({
			...parent,
			$type: "social.colibri.beta.channel.defs#messageView",
		});
	});

	it("leaves the parent off when the replied-to message is not in the list", () => {
		const result = run(
			[
				queued("m2", "spaceCreate", {
					text: "unsent reply",
					parent: { did: DID, rkey: "gone" },
				}),
			],
			[message("m1")],
		);

		expect(result?.[1]?.parent).toBeUndefined();
	});

	it("ignores a malformed parent ref", () => {
		const result = run(
			[queued("m2", "spaceCreate", { text: "unsent", parent: "at://nope" })],
			[message("m1")],
		);

		expect(result?.[1]?.parent).toBeUndefined();
	});
});
