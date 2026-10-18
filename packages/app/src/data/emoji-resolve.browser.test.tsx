import { createEffect, createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import {
	CUSTOM_EMOJI_FEATURE,
	type EmojiCatalogView,
	type EmojiFollowView,
	type EmojiLibraryView,
	type EmojiView,
} from "./emoji";
import { createEmojiStore } from "./emoji-store";
import type { DataSource, LiveEvent } from "./source";
import type { CommunityView, Datetime, Did } from "./types";

const SPACE = "did:plc:space" as Did;
const ARTIST = "did:plc:artist" as Did;
const VIEWER = "did:plc:viewer" as Did;
const CREATED = "2026-10-12T10:00:00.000Z" as Datetime;

const emoji = (owner: Did, name: string): EmojiView => {
	const id = `at://${owner}/blue.moji.collection.item/${name}`;
	return {
		id,
		ref: { provider: "blue.moji", uri: id, owner },
		name,
		images: [{ src: `${name}.png`, format: "png", animated: false }],
		image: `${name}.png`,
		createdAt: CREATED,
	};
};

const catalogOf = (community: Did, emojis: EmojiView[]): EmojiCatalogView => ({
	community,
	emojis,
	packs: [],
});

const packFollow = (rkey: string, emojis: EmojiView[]): EmojiFollowView => {
	const subject = `at://${ARTIST}/blue.moji.packs.pack/${rkey}`;
	return {
		uri: `at://${VIEWER}/social.colibri.beta.emoji.follow/${rkey}`,
		rkey,
		subject,
		kind: "pack",
		state: "available",
		owner: { did: ARTIST, kind: "user", displayName: "Ari" },
		pack: {
			id: subject,
			provider: "blue.moji",
			name: rkey,
			emojis: emojis.map((entry) => entry.id),
			createdAt: CREATED,
		},
		emojis,
		createdAt: CREATED,
	};
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (library: EmojiLibraryView, policy?: string) => {
	const listeners = new Set<(event: LiveEvent) => void>();
	const catalogs: Record<string, EmojiCatalogView> = {
		[SPACE]: catalogOf(SPACE, [emoji(SPACE, "shipit")]),
		[ARTIST]: catalogOf(ARTIST, [emoji(ARTIST, "badger")]),
		[VIEWER]: library.own,
	};
	const source = {
		listEmoji: vi.fn(async (did: Did) => catalogs[did] ?? catalogOf(did, [])),
		getEmojiLibrary: vi.fn(async () => library),
		subscribe: (listener: (event: LiveEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	} as unknown as DataSource;
	const spaces = [
		{ did: SPACE, name: "Colibri HQ", customEmoji: policy },
	] as unknown as CommunityView[];
	const store = createRoot(() =>
		createEmojiStore(
			source,
			() => VIEWER,
			() => spaces,
		),
	);
	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};
	return { store, source, emit };
};

describe("emoji resolution", () => {
	it("resolves an emoji from an unfollowed pack once its owner catalog loads", async () => {
		const badger = emoji(ARTIST, "badger");
		const { store, source } = setup({
			own: catalogOf(VIEWER, []),
			follows: [],
		});
		const resolved = store.emojiByUri(badger.id);
		expect(store.resolve(SPACE, badger.id)).toBeUndefined();
		await flush();
		expect(source.listEmoji).toHaveBeenCalledWith(ARTIST);
		expect(resolved()?.name).toBe("badger");
		expect(store.resolve(SPACE, badger.id)).toBe(resolved());
		expect(
			store.mention(SPACE, { $type: CUSTOM_EMOJI_FEATURE, uri: badger.id })
				?.name,
		).toBe("badger");
	});

	it("checks the Space policy before loading the owner catalog", async () => {
		const badger = emoji(ARTIST, "badger");
		const { store, source } = setup(
			{ own: catalogOf(VIEWER, []), follows: [] },
			"local",
		);
		expect(store.resolve(SPACE, badger.id)).toBeUndefined();
		await flush();
		expect(store.resolve(SPACE, badger.id)).toBeUndefined();
		expect(source.listEmoji).not.toHaveBeenCalledWith(ARTIST);
	});

	it("keeps the resolved emoji when an unrelated pack is followed", async () => {
		const cat = emoji(ARTIST, "cat");
		const owl = emoji(ARTIST, "owl");
		const { store, emit } = setup({
			own: catalogOf(VIEWER, []),
			follows: [packFollow("cats", [cat])],
		});
		store.library();
		await flush();
		const before = store.resolve(SPACE, cat.id);
		expect(before?.name).toBe("cat");
		let runs = 0;
		const dispose = createRoot((done) => {
			const read = store.emojiByUri(cat.id);
			createEffect(() => {
				read();
				runs++;
			});
			return done;
		});
		await flush();
		emit({
			$type: "emojiLibraryEvent",
			library: {
				own: catalogOf(VIEWER, []),
				follows: [
					packFollow("cats", [emoji(ARTIST, "cat")]),
					packFollow("owls", [owl]),
				],
			},
		});
		await flush();
		expect(store.packFollowOf(owl.id)?.rkey).toBe("owls");
		expect(store.resolve(SPACE, cat.id)).toBe(before);
		expect(runs).toBe(1);
		dispose();
	});
});
