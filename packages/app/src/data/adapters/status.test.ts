import { describe, expect, it } from "vitest";
import type { EmojiView } from "../emoji/model";
import type { Status } from "../types";
import { statusCustomEmojiRef, uiStatus } from "./status";

const URI = "at://did:plc:lis/blue.moji.collection.item/party";

const partyBird = {
	id: URI,
	name: "party_bird",
	image: "https://cdn.example/party.webp",
} as EmojiView;

const lookup = {
	lookup: (uri: string) => (uri === URI ? partyBird : undefined),
};

const withCustom = (status: Partial<Status>, uri: string = URI) =>
	({ text: "", ...status, customEmoji: { uri } }) as Status;

describe("uiStatus", () => {
	it("keeps an emoji-only status", () => {
		expect(uiStatus({ text: "", emoji: "🍜" }, lookup)).toEqual({
			text: undefined,
			emoji: "🍜",
			customEmoji: undefined,
			showWhileOffline: undefined,
		});
	});

	it("resolves a custom emoji status", () => {
		expect(uiStatus(withCustom({}), lookup)?.customEmoji).toEqual({
			id: URI,
			name: "party_bird",
			src: "https://cdn.example/party.webp",
		});
	});

	it("drops a status with nothing to show", () => {
		expect(uiStatus({ text: "  " }, lookup)).toBeUndefined();
		expect(
			uiStatus(
				withCustom({}, "at://did:plc:lis/blue.moji.collection.item/x"),
				lookup,
			),
		).toBeUndefined();
	});

	it("ignores a custom emoji ref that is not an at-uri", () => {
		expect(statusCustomEmojiRef(withCustom({}, "https://x"))).toBeUndefined();
	});
});
