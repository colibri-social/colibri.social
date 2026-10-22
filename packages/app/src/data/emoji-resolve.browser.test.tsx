import { ColibriError } from "@colibri-social/lib";
import { createEffect, createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import {
	CUSTOM_EMOJI_FEATURE,
	EMOJI_BATCH_LIMIT,
	type EmojiBatchView,
	type EmojiCatalogView,
	type EmojiFollowView,
	type EmojiLibraryView,
	type EmojiView,
} from "./emoji";
import {
	createEmojiStore,
	EMOJI_RETRY_DELAYS_MS,
	type EmojiSeed,
} from "./emoji-store";
import type { DataSource, LiveEvent } from "./source";
import type { CommunityView, Datetime, Did } from "./types";

const SPACE = "did:plc:space" as Did;
const ARTIST = "did:plc:artist" as Did;
const OTHER = "did:plc:other" as Did;
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

describe("emoji first sight", () => {
	const badger = emoji(ARTIST, "badger");
	const otter = emoji(OTHER, "otter");
	const gone = emoji(ARTIST, "gone");

	const setupBatch = (
		getEmojis: (uris: readonly string[]) => Promise<EmojiBatchView>,
		seed?: EmojiSeed,
	) => {
		const offers: EmojiSeed[] = [];
		const batchSpy = vi.fn(getEmojis);
		const source = {
			listEmoji: vi.fn(async (did: Did) =>
				catalogOf(did, did === ARTIST ? [badger] : []),
			),
			getEmojis: batchSpy,
			getEmojiLibrary: vi.fn(async () => ({
				own: catalogOf(VIEWER, []),
				follows: [],
			})),
			subscribe: () => () => {},
		} as unknown as DataSource;
		const store = createRoot(() =>
			createEmojiStore(
				source,
				() => VIEWER,
				() => [{ did: SPACE, name: "Colibri HQ" } as unknown as CommunityView],
				{ seed, offer: (next) => offers.push(next) },
			),
		);
		return { store, source, offers, batchSpy };
	};

	it("resolves emoji from several owners in one request", async () => {
		const { store, source, offers } = setupBatch(async (uris) => ({
			emojis: [badger, otter].filter((entry) => uris.includes(entry.id)),
			unreachable: [],
		}));
		const first = store.emojiByUri(badger.id);
		const second = store.emojiByUri(otter.id);
		const third = store.emojiByUri(gone.id);
		expect(store.availability(SPACE, badger.id)).toBe("loading");
		await flush();
		expect(source.getEmojis).toHaveBeenCalledTimes(1);
		expect(source.getEmojis).toHaveBeenCalledWith([
			badger.id,
			otter.id,
			gone.id,
		]);
		expect(source.listEmoji).not.toHaveBeenCalledWith(ARTIST);
		expect(first()?.name).toBe("badger");
		expect(second()?.name).toBe("otter");
		expect(third()).toBeUndefined();
		expect(store.availability(SPACE, gone.id)).toBe("unavailable");
		expect(Object.keys(offers.at(-1)?.emojis ?? {})).toEqual([
			badger.id,
			otter.id,
		]);
	});

	it("splits large batches", async () => {
		const { store, batchSpy } = setupBatch(async () => ({
			emojis: [],
			unreachable: [],
		}));
		for (let index = 0; index < EMOJI_BATCH_LIMIT + 1; index++)
			store.emojiByUri(emoji(ARTIST, `e${index}`).id);
		await flush();
		expect(batchSpy.mock.calls.map(([uris]) => uris.length)).toEqual([
			EMOJI_BATCH_LIMIT,
			1,
		]);
	});

	it("falls back to the owner catalog when the AppView lacks the method", async () => {
		const { store, source } = setupBatch(async () => {
			throw new ColibriError({ code: "InternalError", status: 501 });
		});
		const resolved = store.emojiByUri(badger.id);
		await flush();
		await flush();
		expect(source.listEmoji).toHaveBeenCalledWith(ARTIST);
		expect(resolved()?.name).toBe("badger");
		store.emojiByUri(otter.id);
		await flush();
		expect(source.getEmojis).toHaveBeenCalledTimes(1);
	});

	it("retries a failed batch with backoff and recovers", async () => {
		vi.useFakeTimers();
		try {
			let fail = true;
			const { store, source } = setupBatch(async (uris) => {
				if (fail) throw new TypeError("Failed to fetch");
				return {
					emojis: [badger].filter((entry) => uris.includes(entry.id)),
					unreachable: [],
				};
			});
			const resolved = store.emojiByUri(badger.id);
			await vi.advanceTimersByTimeAsync(0);
			expect(resolved()).toBeUndefined();
			expect(store.availability(SPACE, badger.id)).toBe("loading");
			fail = false;
			await vi.advanceTimersByTimeAsync(EMOJI_RETRY_DELAYS_MS[0] ?? 0);
			expect(source.getEmojis).toHaveBeenCalledTimes(2);
			expect(resolved()?.name).toBe("badger");
			expect(source.listEmoji).not.toHaveBeenCalledWith(ARTIST);
		} finally {
			vi.useRealTimers();
		}
	});

	it("asks again for owners the AppView could not reach", async () => {
		vi.useFakeTimers();
		try {
			let reachable = false;
			const { store } = setupBatch(async () =>
				reachable
					? { emojis: [badger], unreachable: [] }
					: { emojis: [], unreachable: [ARTIST] },
			);
			const resolved = store.emojiByUri(badger.id);
			await vi.advanceTimersByTimeAsync(0);
			expect(resolved()).toBeUndefined();
			reachable = true;
			await vi.advanceTimersByTimeAsync(EMOJI_RETRY_DELAYS_MS[0] ?? 0);
			expect(resolved()?.name).toBe("badger");
		} finally {
			vi.useRealTimers();
		}
	});

	it("shows cached emoji at once and revalidates them", async () => {
		const { store, source } = setupBatch(
			async () => ({ emojis: [], unreachable: [] }),
			{ emojis: { [badger.id]: badger } },
		);
		const resolved = store.emojiByUri(badger.id);
		expect(resolved()?.name).toBe("badger");
		await flush();
		expect(source.getEmojis).toHaveBeenCalledWith([badger.id]);
		expect(resolved()).toBeUndefined();
	});

	it("refreshes a failed image through the batch", async () => {
		const fresh = { ...badger, image: "badger-fresh.png" };
		let current = badger;
		const { store, source } = setupBatch(async () => ({
			emojis: [current],
			unreachable: [],
		}));
		const resolved = store.emojiByUri(badger.id);
		await flush();
		current = fresh;
		await expect(store.refreshImage(badger.id, badger.image)).resolves.toBe(
			true,
		);
		expect(source.getEmojis).toHaveBeenCalledTimes(2);
		expect(resolved()?.image).toBe("badger-fresh.png");
		expect(source.listEmoji).not.toHaveBeenCalledWith(ARTIST);
	});
});
