import { describe, expect, it } from "vitest";
import { buildMessageRecord, buildReactionRecord } from "./message-record.js";
import { parseSpaceRecordUri, sameSpaceRecordRef } from "./space-ref.js";

describe("buildMessageRecord", () => {
	it("builds the minimal record for a new message", () => {
		expect(
			buildMessageRecord({
				text: "hello",
				createdAt: "2026-01-01T00:00:00.000Z",
			}),
		).toEqual({
			$type: "social.colibri.beta.message",
			text: "hello",
			createdAt: "2026-01-01T00:00:00.000Z",
		});
	});

	it("omits an empty facets array", () => {
		const record = buildMessageRecord({
			text: "hello",
			createdAt: "2026-01-01T00:00:00.000Z",
			facets: [],
		});
		expect(record.facets).toBeUndefined();
	});

	it("includes updatedAt only when editing", () => {
		const record = buildMessageRecord({
			text: "edited",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
		});
		expect(record.updatedAt).toBe("2026-01-02T00:00:00.000Z");
	});

	it("addresses the reply parent by did and rkey rather than a bare rkey", () => {
		const record = buildMessageRecord({
			text: "a reply",
			createdAt: "2026-01-01T00:00:00.000Z",
			parent: { did: "did:plc:author", rkey: "3lb2c3d4e5f6g" },
		});
		expect(record.parent).toEqual({
			did: "did:plc:author",
			rkey: "3lb2c3d4e5f6g",
		});
	});

	it("omits an empty suppressedEmbeds array", () => {
		const record = buildMessageRecord({
			text: "hello",
			createdAt: "2026-01-01T00:00:00.000Z",
			suppressedEmbeds: [],
		});
		expect(record.suppressedEmbeds).toBeUndefined();
	});
});

describe("record uris", () => {
	const space =
		"at://did:plc:community/space/social.colibri.beta.channel.text/3kchannel";

	it("adds the parent uri when the space is known", () => {
		const record = buildMessageRecord({
			text: "reply",
			createdAt: "2026-01-01T00:00:00.000Z",
			parent: { did: "did:plc:author", rkey: "3lb2c3d4e5f6g" } as never,
			space,
		});
		expect(record.parent).toEqual({
			did: "did:plc:author",
			rkey: "3lb2c3d4e5f6g",
		});
		expect(record.parentUri).toBe(
			`${space}/did:plc:author/social.colibri.beta.message/3lb2c3d4e5f6g`,
		);
	});

	it("adds the target uri to a reaction when the space is known", () => {
		expect(
			buildReactionRecord(
				"🔥",
				{ did: "did:plc:author", rkey: "3lb2c3d4e5f6g" } as never,
				space,
			),
		).toEqual({
			$type: "social.colibri.beta.reaction",
			emoji: "🔥",
			target: { did: "did:plc:author", rkey: "3lb2c3d4e5f6g" },
			uri: `${space}/did:plc:author/social.colibri.beta.message/3lb2c3d4e5f6g`,
		});
	});

	it("reads a same-space record uri and falls back to the reference otherwise", () => {
		const fallback = { did: "did:plc:fallback", rkey: "3kfallback" };
		expect(
			sameSpaceRecordRef(
				space,
				"social.colibri.beta.message",
				`${space}/did:plc:author/social.colibri.beta.message/3kmsg`,
				fallback,
			),
		).toEqual({ did: "did:plc:author", rkey: "3kmsg" });
		expect(
			sameSpaceRecordRef(
				space,
				"social.colibri.beta.message",
				`${space}/did:plc:author/social.colibri.beta.reaction/3kmsg`,
				fallback,
			),
		).toEqual(fallback);
		expect(
			sameSpaceRecordRef(
				space,
				"social.colibri.beta.message",
				"at://did:plc:community/space/social.colibri.beta.channel.text/3kother/did:plc:author/social.colibri.beta.message/3kmsg",
				fallback,
			),
		).toEqual(fallback);
		expect(
			sameSpaceRecordRef(
				space,
				"social.colibri.beta.message",
				"nope",
				undefined,
			),
		).toBeUndefined();
		expect(parseSpaceRecordUri(space)).toBeUndefined();
	});
});

describe("buildReactionRecord", () => {
	it("addresses the target by did and rkey", () => {
		expect(
			buildReactionRecord("🔥", {
				did: "did:plc:author",
				rkey: "3lb2c3d4e5f6g",
			}),
		).toEqual({
			$type: "social.colibri.beta.reaction",
			emoji: "🔥",
			target: { did: "did:plc:author", rkey: "3lb2c3d4e5f6g" },
		});
	});
});
