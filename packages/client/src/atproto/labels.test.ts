import { describe, expect, it } from "vitest";
import {
	EMBEDS_SUPPRESSED,
	embedSuppression,
	HIDDEN,
	isEmbedSuppressed,
	isHidden,
	isSpoilered,
	SPOILER,
} from "./labels";
import { asDatetime, asDid, asUri } from "./lexicons";
import type { LabelView, MessageView } from "./views";

const label = (val: string, scope?: Array<string>): LabelView => ({
	src: asDid("did:plc:labeler"),
	val,
	createdAt: asDatetime("2026-01-01T00:00:00.000Z"),
	...(scope === undefined ? {} : { scope: scope.map(asUri) }),
});

const message = (overrides: Partial<MessageView> = {}): MessageView =>
	({
		uri: "at://did:plc:author/space/social.colibri.beta.channel.text/general/3l",
		rkey: "3l",
		channel:
			"at://did:plc:community/space/social.colibri.beta.channel.text/general",
		author: {
			did: "did:plc:author",
			handle: "author.test",
			displayName: "Author",
			isBot: false,
			syncBluesky: false,
		},
		text: "hello",
		createdAt: "2026-01-01T00:00:00.000Z",
		attachments: [],
		reactions: [],
		labels: [],
		...overrides,
	}) as MessageView;

describe("label values", () => {
	it("matches the lexicon vocabulary", () => {
		expect(HIDDEN).toBe("hidden");
		expect(SPOILER).toBe("spoiler");
		expect(EMBEDS_SUPPRESSED).toBe("embeds-suppressed");
	});
});

describe("isHidden and isSpoilered", () => {
	it("reads the message's labels", () => {
		expect(isHidden(message({ labels: [label(HIDDEN)] }))).toBe(true);
		expect(isHidden(message())).toBe(false);
		expect(isSpoilered(message({ labels: [label(SPOILER)] }))).toBe(true);
		expect(isSpoilered(message({ labels: [label(HIDDEN)] }))).toBe(false);
	});
});

describe("embedSuppression", () => {
	it("collects the author's own suppressions", () => {
		const suppression = embedSuppression(
			message({ suppressedEmbeds: ["https://a.test"] }),
		);
		expect(suppression.all).toBe(false);
		expect(isEmbedSuppressed(suppression, "https://a.test")).toBe(true);
		expect(isEmbedSuppressed(suppression, "https://b.test")).toBe(false);
	});

	it("narrows a scoped moderator label to its uris", () => {
		const suppression = embedSuppression(
			message({ labels: [label(EMBEDS_SUPPRESSED, ["https://b.test"])] }),
		);
		expect(suppression.all).toBe(false);
		expect(isEmbedSuppressed(suppression, "https://b.test")).toBe(true);
		expect(isEmbedSuppressed(suppression, "https://a.test")).toBe(false);
	});

	it("treats an unscoped moderator label as suppressing everything", () => {
		const suppression = embedSuppression(
			message({ labels: [label(EMBEDS_SUPPRESSED)] }),
		);
		expect(suppression.all).toBe(true);
		expect(isEmbedSuppressed(suppression, "https://anything.test")).toBe(true);
	});

	it("treats an empty scope as suppressing everything", () => {
		const suppression = embedSuppression(
			message({ labels: [label(EMBEDS_SUPPRESSED, [])] }),
		);
		expect(suppression.all).toBe(true);
	});

	it("merges the author's suppressions with a scoped label", () => {
		const suppression = embedSuppression(
			message({
				suppressedEmbeds: ["https://a.test"],
				labels: [label(EMBEDS_SUPPRESSED, ["https://b.test"])],
			}),
		);
		expect(isEmbedSuppressed(suppression, "https://a.test")).toBe(true);
		expect(isEmbedSuppressed(suppression, "https://b.test")).toBe(true);
	});

	it("ignores labels with other values", () => {
		const suppression = embedSuppression(
			message({ labels: [label(SPOILER, ["https://a.test"])] }),
		);
		expect(suppression.all).toBe(false);
		expect(suppression.uris.size).toBe(0);
	});
});
