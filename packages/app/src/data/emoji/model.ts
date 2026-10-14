import type { Datetime, Did } from "../types";

export type EmojiFormat = "png" | "webp" | "gif" | "apng" | "lottie" | "other";

export type EmojiImage = {
	src: string;
	cid?: string;
	format: EmojiFormat;
	animated: boolean;
	mimeType?: string;
	size?: number;
	pixels?: number;
};

export type EmojiRef = {
	provider: string;
	uri: string;
	owner: Did;
	cid?: string;
};

export type EmojiView = {
	id: string;
	ref: EmojiRef;
	name: string;
	alt?: string;
	fallback?: string;
	images: EmojiImage[];
	image: string;
	adultOnly?: boolean;
	copyOf?: string;
	createdBy?: Did;
	createdAt: Datetime;
};

export type EmojiPackView = {
	id: string;
	provider: string;
	name: string;
	description?: string;
	emojis: string[];
	createdBy?: Did;
	createdAt: Datetime;
};

export type EmojiCatalogView = {
	community: Did;
	emojis: EmojiView[];
	packs: EmojiPackView[];
};

export type StoredBlob = {
	cid: string;
	mimeType: string;
	size: number;
};

export type BlobLocator = (blob: {
	did: Did;
	cid: string;
	mimeType?: string;
}) => string;

export type ProviderRecord = {
	uri: string;
	cid?: string;
	value: unknown;
};

export type WrittenRecord = {
	collection: string;
	rkey: string;
	value: Record<string, unknown>;
};

export const IMAGE_PREFERENCE: readonly EmojiFormat[] = [
	"webp",
	"png",
	"apng",
	"gif",
	"other",
];

export const bestImage = (images: readonly EmojiImage[]) => {
	for (const format of IMAGE_PREFERENCE) {
		const match = images.find((image) => image.format === format && image.src);
		if (match) return match;
	}
	return undefined;
};

export const shortcodeOf = (name: string) => `:${name}:`;

export const bareName = (shortcode: string) =>
	shortcode.replace(/^:+/, "").replace(/:+$/, "");

export const rkeyOfUri = (uri: string) => uri.split("/").at(-1) ?? "";

export const collectionOfUri = (uri: string) =>
	uri.startsWith("at://") ? (uri.slice(5).split("/")[1] ?? "") : "";

export const repoOfUri = (uri: string) =>
	(uri.startsWith("at://") ? uri.slice(5).split("/")[0] : "") as Did;
