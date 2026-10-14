import type { Datetime, Did } from "../types";
import {
	type BlobLocator,
	collectionOfUri,
	type EmojiPackView,
	type EmojiView,
	type ProviderRecord,
	type StoredBlob,
	shortcodeOf,
	type WrittenRecord,
} from "./model";

export type EmojiItemDraft = {
	owner: Did;
	name: string;
	alt?: string;
	fallback?: string;
	image: StoredBlob;
	createdAt: Datetime;
};

export type EmojiCopyDraft = EmojiItemDraft & { source: EmojiView };

export type EmojiPackDraft = {
	owner: Did;
	rkey: string;
	name: string;
	description?: string;
	createdAt: Datetime;
};

export type EmojiPackSource = {
	packs: readonly ProviderRecord[];
	memberships: readonly ProviderRecord[];
	emojis: readonly EmojiView[];
};

export type EmojiProvider = {
	id: string;
	label: string;
	collections: {
		item: string;
		pack?: string;
		membership?: string;
	};
	readItem: (
		record: ProviderRecord,
		locate: BlobLocator,
	) => EmojiView | undefined;
	writeItem: (draft: EmojiItemDraft) => WrittenRecord;
	writeCopy: (draft: EmojiCopyDraft) => WrittenRecord;
	readPacks?: (source: EmojiPackSource) => EmojiPackView[];
	writePack?: (draft: EmojiPackDraft) => WrittenRecord;
	writeMembership?: (input: {
		owner: Did;
		rkey: string;
		emoji: string;
		pack: string;
		createdAt: Datetime;
	}) => WrittenRecord;
	fallbackText: (emoji: EmojiView) => string;
	altText: (emoji: EmojiView) => string;
};

export const createEmojiRegistry = (providers: readonly EmojiProvider[]) => {
	const byId = new Map(providers.map((provider) => [provider.id, provider]));
	const byCollection = new Map<string, EmojiProvider>();
	for (const provider of providers) {
		for (const collection of Object.values(provider.collections)) {
			if (collection) byCollection.set(collection, provider);
		}
	}

	const get = (id: string) => byId.get(id);

	const require = (id: string) => {
		const provider = byId.get(id);
		if (!provider) throw new Error(`Unknown emoji provider ${id}`);
		return provider;
	};

	const forUri = (uri: string) => byCollection.get(collectionOfUri(uri));

	return {
		providers,
		get,
		require,
		forUri,
		readItem: (record: ProviderRecord, locate: BlobLocator) =>
			forUri(record.uri)?.readItem(record, locate),
		readPacks: (provider: string, source: EmojiPackSource) =>
			get(provider)?.readPacks?.(source) ?? [],
		fallbackText: (emoji: EmojiView) =>
			get(emoji.ref.provider)?.fallbackText(emoji) ?? shortcodeOf(emoji.name),
		altText: (emoji: EmojiView) =>
			get(emoji.ref.provider)?.altText(emoji) ?? shortcodeOf(emoji.name),
	};
};

export type EmojiRegistry = ReturnType<typeof createEmojiRegistry>;
