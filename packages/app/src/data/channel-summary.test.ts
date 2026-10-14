import { describe, expect, it } from "vitest";
import { newerSummary, summarizeMessage } from "./channel-summary";
import type { MessageView } from "./types";

const message = (overrides: Partial<MessageView> = {}): MessageView =>
	({
		uri: "at://did:plc:a/social.colibri.beta.channel.message/r1",
		rkey: "r1",
		channel: "at://did:plc:hq/space/c1",
		author: { did: "did:plc:a", handle: "a.test" },
		text: "Hello\n  there",
		createdAt: "2026-10-12T10:00:00.000Z",
		attachments: [],
		reactions: [],
		labels: [],
		...overrides,
	}) as MessageView;

describe("channel summary", () => {
	it("collapses whitespace and keeps the author and time", () => {
		expect(summarizeMessage(message())).toEqual({
			channel: "at://did:plc:hq/space/c1",
			rkey: "r1",
			author: "did:plc:a",
			text: "Hello there",
			createdAt: "2026-10-12T10:00:00.000Z",
		});
	});

	it("describes attachment-only messages", () => {
		const image = { url: "https://x/a.png", mimeType: "image/png" };
		const file = { url: "https://x/a.pdf", mimeType: "application/pdf" };
		expect(
			summarizeMessage(message({ text: "", attachments: [image] as never })),
		).toMatchObject({ text: "Sent an image", attachment: "image" });
		expect(
			summarizeMessage(
				message({ text: "", attachments: [file, file] as never }),
			),
		).toMatchObject({ text: "Sent 2 files", attachment: "file" });
		expect(
			summarizeMessage(
				message({ text: "look", attachments: [image] as never }),
			),
		).toMatchObject({ text: "look", attachment: "image" });
	});

	it("keeps the newest summary", () => {
		const old = summarizeMessage(message());
		const next = summarizeMessage(
			message({ rkey: "r2", createdAt: "2026-10-12T11:00:00.000Z" }),
		);
		expect(newerSummary(undefined, old)).toBe(true);
		expect(newerSummary(next, old)).toBe(false);
		expect(newerSummary(old, next)).toBe(true);
		expect(newerSummary(old, { ...old, text: "edited" })).toBe(true);
	});
});
