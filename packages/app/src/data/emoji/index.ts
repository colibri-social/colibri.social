import type { Did } from "../types";
import type {
	BlobLocator,
	EmojiCatalogView,
	EmojiFollowView,
	EmojiLibraryView,
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

export type EmojiLibraryEvent = {
	$type: "emojiLibraryEvent";
	library: EmojiLibraryView;
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
			| "UnsupportedProvider"
			| "ImageTooLarge"
			| "UnsupportedImage"
			| "OwnEmoji"
			| "UpstreamFailure",
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
	getEmojiLibrary: () => Promise<EmojiLibraryView>;
	followEmoji: (input: { subject: string }) => Promise<EmojiFollowView>;
	unfollowEmoji: (input: { rkey: string }) => Promise<void>;
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

export const followOf = (
	library: EmojiLibraryView | undefined,
	subject: string,
) => library?.follows.find((follow) => follow.subject === subject);

export const packFollowOf = (
	library: EmojiLibraryView | undefined,
	emoji: string,
) =>
	library?.follows.find(
		(follow) =>
			follow.kind === "pack" &&
			(follow.pack?.emojis.includes(emoji) ||
				follow.emojis.some((entry) => entry.id === emoji)),
	);
