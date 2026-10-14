import type { Datetime, Did } from "../../types";
import {
	type BlobLocator,
	bareName,
	bestImage,
	type EmojiFormat,
	type EmojiImage,
	type EmojiPackView,
	type EmojiView,
	type ProviderRecord,
	repoOfUri,
	rkeyOfUri,
	type StoredBlob,
	shortcodeOf,
} from "../model";
import type { EmojiProvider } from "../provider";

export const BLUEMOJI = {
	provider: "blue.moji",
	item: "blue.moji.collection.item",
	pack: "blue.moji.packs.pack",
	packItem: "blue.moji.packs.packitem",
	itemFormatsV0: "blue.moji.collection.item#formats_v0",
	itemFormatsV1: "blue.moji.collection.item#formats_v1",
} as const;

export type BlobRef = {
	$type?: "blob";
	ref?: { $link: string };
	cid?: string;
	mimeType: string;
	size?: number;
};

type FormatKey = "png_128" | "webp_128" | "gif_128" | "apng_128" | "lottie";

export type BluemojiItemFormats = {
	$type?: string;
	original?: BlobRef;
} & Partial<Record<FormatKey, BlobRef | Uint8Array | string>>;

export type BluemojiItem = {
	$type?: typeof BLUEMOJI.item;
	name: string;
	alt?: string;
	createdAt: Datetime;
	formats: BluemojiItemFormats;
	adultOnly?: boolean;
	copyOf?: string;
	fallbackText?: string;
};

export type BluemojiPack = {
	$type?: typeof BLUEMOJI.pack;
	name: string;
	description?: string;
	createdAt: Datetime;
	adultOnly?: boolean;
};

export type BluemojiPackItem = {
	$type?: typeof BLUEMOJI.packItem;
	subject: string;
	pack: string;
	createdAt: Datetime;
};

const FORMATS: readonly { key: FormatKey; format: EmojiFormat }[] = [
	{ key: "webp_128", format: "webp" },
	{ key: "png_128", format: "png" },
	{ key: "apng_128", format: "apng" },
	{ key: "gif_128", format: "gif" },
	{ key: "lottie", format: "lottie" },
];

const ANIMATED: ReadonlySet<EmojiFormat> = new Set(["apng", "gif", "lottie"]);

const NAME_RKEY = /^[a-zA-Z0-9_~.:-]{1,512}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const cidOf = (value: unknown) => {
	if (typeof value === "string") return value;
	if (!isObject(value)) return undefined;
	const ref = value.ref;
	if (isObject(ref) && typeof ref.$link === "string") return ref.$link;
	if (typeof value.cid === "string") return value.cid;
	return undefined;
};

export const bluemojiRkey = (name: string) => {
	const bare = bareName(name);
	if (!NAME_RKEY.test(bare)) {
		throw new Error(`Unsupported Bluemoji alias ${name}`);
	}
	return bare;
};

const blobRef = (blob: StoredBlob): BlobRef => ({
	$type: "blob",
	ref: { $link: blob.cid },
	mimeType: blob.mimeType,
	size: blob.size,
});

const formatForMime = (mimeType: string): FormatKey => {
	if (mimeType === "image/webp") return "webp_128";
	if (mimeType === "image/gif") return "gif_128";
	if (mimeType === "image/apng") return "apng_128";
	if (mimeType === "application/lottie+zip") return "lottie";
	return "png_128";
};

const imagesOf = (
	did: Did,
	formats: Record<string, unknown>,
	locate: BlobLocator,
): EmojiImage[] => {
	const images: EmojiImage[] = [];
	for (const { key, format } of FORMATS) {
		const value = formats[key];
		const cid = cidOf(value);
		if (!cid) continue;
		const mimeType = isObject(value)
			? (value.mimeType as string | undefined)
			: undefined;
		images.push({
			src: locate({ did, cid, mimeType }),
			cid,
			format,
			animated: ANIMATED.has(format),
			mimeType,
			size: isObject(value) ? (value.size as number | undefined) : undefined,
			pixels: format === "lottie" ? undefined : 128,
		});
	}
	return images;
};

const isItem = (value: unknown): value is BluemojiItem =>
	isObject(value) &&
	typeof value.name === "string" &&
	typeof value.createdAt === "string" &&
	isObject(value.formats);

const readItem = (
	record: ProviderRecord,
	locate: BlobLocator,
): EmojiView | undefined => {
	if (!isItem(record.value)) return undefined;
	const item = record.value;
	const owner = repoOfUri(record.uri);
	const images = imagesOf(owner, item.formats, locate);
	const original = cidOf(item.formats.original);
	if (images.length === 0 && original && item.formats.original) {
		images.push({
			src: locate({
				did: owner,
				cid: original,
				mimeType: item.formats.original.mimeType,
			}),
			cid: original,
			format: "other",
			animated: false,
			mimeType: item.formats.original.mimeType,
			size: item.formats.original.size,
		});
	}
	const image = bestImage(images);
	if (!image) return undefined;
	return {
		id: record.uri,
		ref: {
			provider: BLUEMOJI.provider,
			uri: record.uri,
			owner,
			cid: record.cid,
		},
		name: bareName(item.name),
		alt: item.alt,
		fallback: item.fallbackText?.trim() || undefined,
		images,
		image: image.src,
		adultOnly: item.adultOnly || undefined,
		copyOf: item.copyOf,
		createdAt: item.createdAt,
	};
};

const isPack = (value: unknown): value is BluemojiPack =>
	isObject(value) &&
	typeof value.name === "string" &&
	typeof value.createdAt === "string";

const isPackItem = (value: unknown): value is BluemojiPackItem =>
	isObject(value) &&
	typeof value.subject === "string" &&
	typeof value.pack === "string";

const readPacks: NonNullable<EmojiProvider["readPacks"]> = (source) => {
	const known = new Set(source.emojis.map((emoji) => emoji.id));
	const memberships = source.memberships
		.map((record) => record.value)
		.filter(isPackItem)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	return source.packs.flatMap((record): EmojiPackView[] => {
		if (!isPack(record.value)) return [];
		const emojis = [
			...new Set(
				memberships
					.filter((entry) => entry.pack === record.uri)
					.map((entry) => entry.subject)
					.filter((subject) => known.has(subject)),
			),
		];
		return [
			{
				id: record.uri,
				provider: BLUEMOJI.provider,
				name: record.value.name,
				description: record.value.description,
				emojis,
				createdAt: record.value.createdAt,
			},
		];
	});
};

const fallbackText = (emoji: EmojiView) =>
	emoji.fallback?.trim() || shortcodeOf(emoji.name);

const altText = (emoji: EmojiView) =>
	emoji.alt?.trim() || emoji.fallback?.trim() || shortcodeOf(emoji.name);

const writeItem: EmojiProvider["writeItem"] = (draft) => {
	const key = formatForMime(draft.image.mimeType);
	const value: BluemojiItem = {
		$type: BLUEMOJI.item,
		name: shortcodeOf(draft.name),
		createdAt: draft.createdAt,
		formats: {
			$type: BLUEMOJI.itemFormatsV1,
			original: blobRef(draft.image),
			[key]: blobRef(draft.image),
		},
	};
	if (draft.alt) value.alt = draft.alt;
	if (draft.fallback) value.fallbackText = draft.fallback;
	return {
		collection: BLUEMOJI.item,
		rkey: bluemojiRkey(draft.name),
		value,
	};
};

const writeCopy: EmojiProvider["writeCopy"] = (draft) => {
	const written = writeItem(draft);
	const value = written.value as BluemojiItem;
	value.copyOf = draft.source.ref.uri;
	if (draft.source.adultOnly) value.adultOnly = true;
	return written;
};

export const bluemojiProvider: EmojiProvider = {
	id: BLUEMOJI.provider,
	label: "Bluemoji",
	collections: {
		item: BLUEMOJI.item,
		pack: BLUEMOJI.pack,
		membership: BLUEMOJI.packItem,
	},
	readItem,
	writeItem,
	writeCopy,
	readPacks,
	writePack: (draft) => {
		const value: BluemojiPack = {
			$type: BLUEMOJI.pack,
			name: draft.name,
			createdAt: draft.createdAt,
		};
		if (draft.description) value.description = draft.description;
		return { collection: BLUEMOJI.pack, rkey: draft.rkey, value };
	},
	writeMembership: (input) => ({
		collection: BLUEMOJI.packItem,
		rkey: input.rkey,
		value: {
			$type: BLUEMOJI.packItem,
			subject: input.emoji,
			pack: input.pack,
			createdAt: input.createdAt,
		} satisfies BluemojiPackItem,
	}),
	fallbackText,
	altText,
};

export const bluemojiItemUri = (owner: Did, name: string) =>
	`at://${owner}/${BLUEMOJI.item}/${bluemojiRkey(name)}`;

export const isBluemojiItemUri = (uri: string) =>
	uri.includes(`/${BLUEMOJI.item}/`) && rkeyOfUri(uri).length > 0;
