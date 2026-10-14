import type { Did } from "../types";
import type {
	BlobLocator,
	EmojiCatalogView,
	EmojiPackView,
	EmojiView,
} from "./model";

export * from "./model";
export * from "./policy";
export * from "./provider";
export * from "./references";
export * from "./registry";

export const EMOJI_PERMISSION = "community.manage";

export type UploadEmojiInput = {
	community: Did;
	name: string;
	file: File;
	pack?: string;
	provider?: string;
};

export type UpdateEmojiPackInput = {
	community: Did;
	pack: string;
	name?: string;
	emojis?: string[];
};

export type EmojiEvent = {
	$type: "emojiEvent";
	catalog: EmojiCatalogView;
};

export class EmojiError extends Error {
	constructor(
		readonly code:
			| "Forbidden"
			| "InvalidName"
			| "NameTaken"
			| "EmojiNotFound"
			| "PackNotFound"
			| "UploadFailed"
			| "UnsupportedProvider",
	) {
		super(code);
		this.name = "EmojiError";
	}
}

export type EmojiSource = {
	emojiBlobUrl: BlobLocator;
	listEmoji: (community: Did) => Promise<EmojiCatalogView>;
	uploadEmoji: (input: UploadEmojiInput) => Promise<EmojiView>;
	renameEmoji: (input: {
		community: Did;
		emoji: string;
		name: string;
	}) => Promise<EmojiView>;
	deleteEmoji: (input: { community: Did; emoji: string }) => Promise<void>;
	createEmojiPack: (input: {
		community: Did;
		name: string;
		emojis: string[];
	}) => Promise<EmojiPackView>;
	updateEmojiPack: (input: UpdateEmojiPackInput) => Promise<EmojiPackView>;
	deleteEmojiPack: (input: { community: Did; pack: string }) => Promise<void>;
	followEmoji: (input: { emoji: string }) => Promise<EmojiView>;
	unfollowEmoji: (input: { emoji: string }) => Promise<void>;
	followEmojiPack: (input: {
		community: Did;
		pack: string;
	}) => Promise<EmojiPackView>;
	unfollowEmojiPack: (input: { community: Did; pack: string }) => Promise<void>;
};

export const ungroupedEmoji = (catalog: EmojiCatalogView) => {
	const grouped = new Set(catalog.packs.flatMap((pack) => pack.emojis));
	return catalog.emojis.filter((emoji) => !grouped.has(emoji.id));
};

export const packEmoji = (catalog: EmojiCatalogView, pack: EmojiPackView) => {
	const byId = new Map(catalog.emojis.map((emoji) => [emoji.id, emoji]));
	return pack.emojis
		.map((id) => byId.get(id))
		.filter((emoji): emoji is EmojiView => !!emoji);
};

export const sourceOf = (emoji: EmojiView) => emoji.copyOf ?? emoji.id;

export const followedCopy = (
	followed: EmojiCatalogView | undefined,
	source: string,
) => followed?.emojis.find((emoji) => sourceOf(emoji) === source);

export const followedPack = (
	followed: EmojiCatalogView | undefined,
	pack: EmojiPackView,
) => {
	if (!followed || pack.emojis.length === 0) return undefined;
	const sources = new Map(
		followed.emojis.map((emoji) => [emoji.id, sourceOf(emoji)]),
	);
	return followed.packs.find(
		(candidate) =>
			candidate.name === pack.name &&
			pack.emojis.every((id) =>
				candidate.emojis.some((copy) => sources.get(copy) === id),
			),
	);
};
