import { describe, expect, it } from "vitest";
import {
	newerSummary,
	summarizeChannel,
	summarizeMessage,
	summarizePending,
	summaryParts,
} from "./channel-summary";
import type { Facet, MessageView } from "./types";

const KEK = "at://did:plc:hq/blue.moji.collection.item/kek";

const emojiFacet = (byteStart: number, byteEnd: number, uri = KEK): Facet => ({
	index: { byteStart, byteEnd },
	features: [
		{ $type: "social.colibri.beta.richtext.facet#customEmoji", uri },
	] as Facet["features"],
});

const emojiFor = (feature: Facet["features"][number]) =>
	"uri" in feature && feature.uri === KEK ? { name: "kek" } : undefined;

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

	it("keeps emoji facets aligned after collapsing whitespace", () => {
		const summary = summarizeMessage(
			message({
				text: "  It'll\n\n  be fine :kek:  ",
				facets: [emojiFacet(19, 24)],
			}),
		);
		expect(summary.text).toBe("It'll be fine :kek:");
		expect(summary.facets?.[0]?.index).toEqual({ byteStart: 14, byteEnd: 19 });
		expect(summaryParts(summary, emojiFor)).toEqual([
			"It'll be fine ",
			{ name: "kek" },
		]);
	});

	it("reads facets from an AppView summary", () => {
		const summary = summarizeChannel({
			channel: "at://did:plc:hq/space/social.colibri.beta.channel.text/c1",
			rkey: "r1",
			author: "did:plc:a",
			text: "🦉 :kek: ok",
			facets: [emojiFacet(5, 10)],
			attachmentCount: 0,
			forward: false,
			createdAt: "2026-10-12T10:00:00.000Z",
		} as Parameters<typeof summarizeChannel>[0]);
		expect(summaryParts(summary, emojiFor)).toEqual([
			"🦉 ",
			{ name: "kek" },
			" ok",
		]);
	});

	it("leaves unresolved emoji as their text", () => {
		const summary = summarizeMessage(
			message({
				text: ":owl: hi",
				facets: [
					emojiFacet(0, 5, "at://did:plc:x/blue.moji.collection.item/owl"),
				],
			}),
		);
		expect(summaryParts(summary, emojiFor)).toEqual([":owl: hi"]);
	});

	it("drops facets when the text falls back to an attachment label", () => {
		const summary = summarizeMessage(
			message({
				text: "   ",
				facets: [emojiFacet(0, 2)],
				attachments: [{ mimeType: "image/png" }] as MessageView["attachments"],
			}),
		);
		expect(summary.facets).toBeUndefined();
	});

	it("summarizes a pending message from its uploads", () => {
		const pending = {
			channel: "at://did:plc:hq/space/c1" as MessageView["channel"],
			rkey: "r2",
			text: "",
			uploads: [
				{ file: new File([], "a.png", { type: "image/png" }) },
				{ file: new File([], "b.png", { type: "image/png" }) },
			],
			createdAt: "2026-10-12T10:00:00.000Z",
		};
		expect(summarizePending(pending, "did:plc:me")).toEqual({
			channel: "at://did:plc:hq/space/c1",
			rkey: "r2",
			author: "did:plc:me",
			text: "Sent 2 images",
			attachment: "image",
			createdAt: "2026-10-12T10:00:00.000Z",
		});
		expect(
			summarizePending({ ...pending, text: "hi\n there" }, "did:plc:me").text,
		).toBe("hi there");
	});
});
