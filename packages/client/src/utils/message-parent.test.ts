import { describe, expect, it } from "vitest";
import type { MessageParent } from "../atproto/views";
import { isKnownParentType, parentAvailability } from "./message-parent";

const visibleParent: MessageParent = {
	$type: "social.colibri.beta.channel.defs#messageView",
	uri: "at://did:plc:author/social.colibri.beta.message/3lb1",
	rkey: "3lb1",
	channel:
		"at://did:plc:community/space/social.colibri.beta.channel.text/general",
	author: {
		did: "did:plc:author",
		handle: "author.example",
		displayName: "Author",
		isBot: false,
		syncBluesky: false,
	},
	text: "hello",
	createdAt: "2026-01-01T00:00:00.000Z",
	attachments: [],
	reactions: [],
	labels: [],
};

const deletedParent: MessageParent = {
	$type: "social.colibri.beta.channel.defs#deletedMessageView",
	uri: "at://did:plc:author/social.colibri.beta.message/3lb1",
	rkey: "3lb1",
	channel:
		"at://did:plc:community/space/social.colibri.beta.channel.text/general",
};

const unknownParent: MessageParent = {
	$type: "com.example.future.parentKind",
	someField: "opaque",
} as unknown as MessageParent;

describe("parentAvailability", () => {
	it("treats a resolved messageView as visible", () => {
		expect(parentAvailability(visibleParent)).toBe("visible");
	});

	it("treats a deletedMessageView stand-in as unavailable", () => {
		expect(parentAvailability(deletedParent)).toBe("unavailable");
	});

	it("treats an unrecognized future $type as unavailable, not visible", () => {
		expect(parentAvailability(unknownParent)).toBe("unavailable");
	});
});

describe("isKnownParentType", () => {
	it("recognizes the visible and deleted arms", () => {
		expect(isKnownParentType(visibleParent)).toBe(true);
		expect(isKnownParentType(deletedParent)).toBe(true);
	});

	it("does not recognize a forward-compatible unknown arm", () => {
		expect(isKnownParentType(unknownParent)).toBe(false);
	});
});
