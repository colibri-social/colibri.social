import { describe, expect, it } from "vitest";
import { buildMessageRecord, buildReactionRecord } from "./message-record";

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
