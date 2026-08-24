import { describe, expect, it } from "vitest";
import { asDatetime } from "../atproto/lexicons";
import type { LabelEventFrame } from "../atproto/sync-frames";
import type { LabelView, MessageView } from "../atproto/views";
import { foldLabelEvent } from "./message-labels";

const AUTHOR_DID = "did:plc:author";
const MODERATOR_DID = "did:plc:moderator";
const VIEWER_DID = "did:plc:viewer";
const SPACE =
	"at://did:plc:community/space/social.colibri.beta.channel.text/general";

const now = () => "2026-01-01T00:00:00.000Z";

const label = (val: string): LabelView => ({
	src: MODERATOR_DID as unknown as LabelView["src"],
	val,
	createdAt: asDatetime(now()),
});

type Subject = Pick<MessageView, "author" | "rkey" | "labels">;

const message = (labels: Array<LabelView> = []): Subject => ({
	author: { did: AUTHOR_DID } as unknown as MessageView["author"],
	rkey: "3lb1",
	labels,
});

const hiddenEvent = (
	event: "create" | "negate",
	overrides: Partial<LabelEventFrame> = {},
): LabelEventFrame => ({
	$type: "social.colibri.beta.sync.defs#labelEvent",
	event,
	space: SPACE,
	subject: {
		did: AUTHOR_DID,
		collection: "social.colibri.beta.message",
		rkey: "3lb1",
	},
	val: "hidden",
	src: MODERATOR_DID,
	...overrides,
});

describe("foldLabelEvent", () => {
	it("ignores an event for a different message", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("create", {
				subject: {
					did: AUTHOR_DID,
					collection: "social.colibri.beta.message",
					rkey: "other",
				},
			}),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({ kind: "noop" });
	});

	it("removes the message when hidden is created for an ordinary viewer", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("create"),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({ kind: "remove" });
	});

	it("keeps the message for its own author and records the label", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("create"),
			{ did: AUTHOR_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({
			kind: "update",
			labels: [{ src: MODERATOR_DID, val: "hidden", createdAt: now() }],
		});
	});

	it("keeps the message for a moderator holding label.apply and records the label", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("create"),
			{ did: VIEWER_DID, canApplyLabel: true },
			now,
		);
		expect(result).toEqual({
			kind: "update",
			labels: [{ src: MODERATOR_DID, val: "hidden", createdAt: now() }],
		});
	});

	it("does not duplicate a hidden label already present for a moderator", () => {
		const result = foldLabelEvent(
			message([label("hidden")]),
			hiddenEvent("create"),
			{ did: VIEWER_DID, canApplyLabel: true },
			now,
		);
		expect(result).toEqual({ kind: "noop" });
	});

	it("drops the hidden label for a moderator on negate", () => {
		const result = foldLabelEvent(
			message([label("hidden")]),
			hiddenEvent("negate"),
			{ did: VIEWER_DID, canApplyLabel: true },
			now,
		);
		expect(result).toEqual({ kind: "update", labels: [] });
	});

	it("does nothing on a hidden negate for an ordinary viewer, since a messageEvent republishes the message", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("negate"),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({ kind: "noop" });
	});

	it("folds a spoiler label into the message's labels on create", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("create", { val: "spoiler" }),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({
			kind: "update",
			labels: [{ src: MODERATOR_DID, val: "spoiler", createdAt: now() }],
		});
	});

	it("does not duplicate a label already present", () => {
		const result = foldLabelEvent(
			message([label("spoiler")]),
			hiddenEvent("create", { val: "spoiler" }),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({ kind: "noop" });
	});

	it("removes a label on negate", () => {
		const result = foldLabelEvent(
			message([label("spoiler")]),
			hiddenEvent("negate", { val: "spoiler" }),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({ kind: "update", labels: [] });
	});

	it("does nothing negating a label that was never applied", () => {
		const result = foldLabelEvent(
			message(),
			hiddenEvent("negate", { val: "embeds-suppressed" }),
			{ did: VIEWER_DID, canApplyLabel: false },
			now,
		);
		expect(result).toEqual({ kind: "noop" });
	});
});
