import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type {
	EmojiCatalogView,
	EmojiFollowView,
	EmojiLibraryView,
	EmojiView,
} from "./emoji";
import {
	createEmojiStore,
	EMOJI_RETRY_DELAYS_MS,
	EMOJI_WAKE_SPACING_MS,
	OWN_EMOJI_LABEL,
	pickerPacks,
} from "./emoji-store";
import type { DataSource, LiveEvent } from "./source";
import type { CommunityView, Datetime, Did } from "./types";

const SPACE = "did:plc:space" as Did;
const OTHER = "did:plc:other" as Did;
const ARTIST = "did:plc:artist" as Did;
const VIEWER = "did:plc:viewer" as Did;

const emoji = (owner: Did, name: string): EmojiView => {
	const id = `at://${owner}/blue.moji.collection.item/${name}`;
	return {
		id,
		ref: { provider: "blue.moji", uri: id, owner },
		name,
		images: [{ src: `${name}.png`, format: "png", animated: false }],
		image: `${name}.png`,
		createdAt: "2026-10-12T10:00:00.000Z" as Datetime,
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
			name: "Cats",
			emojis: emojis.map((entry) => entry.id),
			createdAt: "2026-10-12T10:00:00.000Z" as Datetime,
		},
		emojis,
		createdAt: "2026-10-12T10:00:00.000Z" as Datetime,
	};
};

const singleFollow = (
	rkey: string,
	target: EmojiView,
	owner: EmojiFollowView["owner"] = {
		did: ARTIST,
		kind: "user",
		handle: "ari.test",
	},
): EmojiFollowView => ({
	uri: `at://${VIEWER}/social.colibri.beta.emoji.follow/${rkey}`,
	rkey,
	subject: target.id,
	kind: "emoji",
	state: "available",
	owner,
	emojis: [target],
	createdAt: "2026-10-12T11:00:00.000Z" as Datetime,
});

const community = (did: Did, name: string, customEmoji?: string) =>
	({ did, name, customEmoji }) as unknown as CommunityView;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (
	library: EmojiLibraryView,
	policy?: string,
	extra: Record<string, EmojiCatalogView> = {},
) => {
	const listeners = new Set<(event: LiveEvent) => void>();
	const catalogs: Record<string, EmojiCatalogView> = {
		[SPACE]: catalogOf(SPACE, [emoji(SPACE, "kek"), emoji(SPACE, "shipit")]),
		[OTHER]: catalogOf(OTHER, [emoji(OTHER, "kek")]),
		[VIEWER]: library.own,
		...extra,
	};
	const source = {
		listEmoji: vi.fn(async (did: Did) => catalogs[did] ?? catalogOf(did, [])),
		getEmojiLibrary: vi.fn(async () => library),
		followEmoji: vi.fn(async ({ subject }: { subject: string }) =>
			singleFollow("3new", emoji(ARTIST, subject.split("/").at(-1) ?? "")),
		),
		unfollowEmoji: vi.fn(async () => {}),
		subscribe: (listener: (event: LiveEvent) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	} as unknown as DataSource;
	const store = createRoot(() =>
		createEmojiStore(
			source,
			() => VIEWER,
			() => [community(SPACE, "Colibri HQ", policy), community(OTHER, "Owls")],
		),
	);
	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};
	return { store, source, emit };
};

const warmUp = async (store: ReturnType<typeof setup>["store"]) => {
	store.scope(SPACE);
	await flush();
	await flush();
};

describe("picker packs", () => {
	it("groups a Space catalog under its name", () => {
		const space = catalogOf(SPACE, [emoji(SPACE, "shipit")]);
		expect(pickerPacks(space, "Colibri HQ")[0]?.name).toBe("Colibri HQ");
	});
});

describe("emoji scope", () => {
	const cat = emoji(ARTIST, "cat");
	const owl = emoji(ARTIST, "owl");
	const library: EmojiLibraryView = {
		own: catalogOf(VIEWER, [emoji(VIEWER, "mine")]),
		follows: [packFollow("3pack", [cat]), singleFollow("3single", owl)],
	};

	it("orders the Space, your emoji, followed packs, followed emoji, then other Spaces", async () => {
		const { store } = setup(library);
		await warmUp(store);
		expect(store.scope(SPACE).map((entry) => entry.label)).toEqual([
			"Colibri HQ",
			OWN_EMOJI_LABEL,
			"Cats",
			"@ari.test",
			"Owls",
		]);
		const packs = store.packs(SPACE);
		expect(packs.find((pack) => pack.name === "Cats")?.author).toBe("Ari");
	});

	it("names a followed emoji's section after its pack", async () => {
		const artistCatalog: EmojiCatalogView = {
			community: ARTIST,
			emojis: [owl],
			packs: [
				{
					id: `at://${ARTIST}/blue.moji.packs.pack/birds`,
					provider: "blue.moji",
					name: "Pack by Lou",
					emojis: [owl.id],
					createdAt: "2026-10-12T10:00:00.000Z" as Datetime,
				},
			],
		};
		const { store } = setup(library, undefined, { [ARTIST]: artistCatalog });
		await warmUp(store);
		await warmUp(store);
		const section = store
			.packs(SPACE)
			.find((pack) => pack.name === "Pack by Lou");
		expect(section?.author).toBe("@ari.test");
		expect(section?.emojis.map((entry) => entry.name)).toEqual(["owl"]);
		expect(store.packs(SPACE).map((pack) => pack.name)).not.toContain(
			"@ari.test",
		);
	});

	it("keeps a followed Space emoji in that Space's section", async () => {
		const shipit = emoji(SPACE, "shipit");
		const owlsKek = emoji(OTHER, "kek");
		const spaceOwner = { did: SPACE, kind: "community" as const };
		const otherOwner = { did: OTHER, kind: "community" as const };
		const { store } = setup({
			own: catalogOf(VIEWER, []),
			follows: [
				singleFollow("3ship", shipit, spaceOwner),
				singleFollow("3kek", owlsKek, otherOwner),
			],
		});
		await warmUp(store);
		const inSpace = store.packs(SPACE);
		expect(inSpace.map((pack) => pack.name)).toEqual(["Colibri HQ", "Owls"]);
		expect(
			inSpace
				.find((pack) => pack.name === "Owls")
				?.emojis.map((entry) => entry.id),
		).toEqual([owlsKek.id]);

		store.scope(undefined);
		await flush();
		await flush();
		expect(store.packs(undefined).map((pack) => pack.name)).toEqual([
			"Colibri HQ",
			"Owls",
		]);
	});

	it("lists your packed emoji under their pack and only loose ones as yours", async () => {
		const zeta = emoji(VIEWER, "zeta");
		const alpha = emoji(VIEWER, "Alpha");
		const loose = emoji(VIEWER, "loose");
		const { store } = setup({
			own: {
				community: VIEWER,
				emojis: [zeta, loose, alpha],
				packs: [
					{
						id: `at://${VIEWER}/blue.moji.packs.pack/atmo`,
						provider: "blue.moji",
						name: "Atmologos",
						emojis: [zeta.id, alpha.id],
						createdAt: "2026-10-12T10:00:00.000Z" as Datetime,
					},
				],
			},
			follows: [],
		});
		await warmUp(store);
		const packs = store.packs(SPACE);
		expect(
			packs
				.find((pack) => pack.name === OWN_EMOJI_LABEL)
				?.emojis.map((entry) => entry.name),
		).toEqual(["loose"]);
		expect(
			packs
				.find((pack) => pack.name === "Atmologos")
				?.emojis.map((entry) => entry.name),
		).toEqual(["Alpha", "zeta"]);
	});

	it("turns a usage uri into a reaction shortcode only when the name is unambiguous", async () => {
		const { store } = setup(library);
		await warmUp(store);
		expect(store.reactionShortcode(SPACE, emoji(SPACE, "shipit").id)).toBe(
			":shipit:",
		);
		expect(
			store.reactionShortcode(SPACE, emoji(OTHER, "kek").id),
		).toBeUndefined();
		expect(
			store.reactionShortcode(undefined, emoji(SPACE, "shipit").id),
		).toBeUndefined();
	});

	it("drops usage uris the Space policy disallows", async () => {
		const { store } = setup(library, "local");
		await warmUp(store);
		expect(
			store.reactionShortcode(SPACE, emoji(VIEWER, "mine").id),
		).toBeUndefined();
		expect(store.reactionShortcode(SPACE, emoji(SPACE, "kek").id)).toBe(
			":kek:",
		);
	});

	it("keeps local policy to the Space's own emoji", async () => {
		const { store } = setup(library, "local");
		await warmUp(store);
		expect(store.scope(SPACE).map((entry) => entry.label)).toEqual([
			"Colibri HQ",
		]);
	});

	it("shows every emoji with a duplicate name and resolves typing to the first", async () => {
		const { store } = setup(library);
		await warmUp(store);
		const results = store.search(SPACE, "kek", 10);
		expect(results.map((entry) => entry.source)).toEqual([
			"Colibri HQ",
			"Owls",
		]);
		expect(store.find(SPACE, "kek")?.id).toBe(emoji(SPACE, "kek").id);
	});
});

describe("emoji follows", () => {
	it("pushes follows and unfollows and applies library events", async () => {
		const owl = emoji(ARTIST, "owl");
		const { store, source, emit } = setup({
			own: catalogOf(VIEWER, []),
			follows: [],
		});
		await warmUp(store);
		await store.follow(owl.id);
		expect(source.followEmoji).toHaveBeenCalledWith({ subject: owl.id });
		expect(store.followOf(owl.id)?.rkey).toBe("3new");

		await store.unfollow(owl.id);
		expect(source.unfollowEmoji).toHaveBeenCalledWith({ rkey: "3new" });
		expect(store.followOf(owl.id)).toBeUndefined();

		const cat = emoji(ARTIST, "cat");
		emit({
			$type: "emojiLibraryEvent",
			library: {
				own: catalogOf(VIEWER, [emoji(VIEWER, "mine")]),
				follows: [packFollow("3pack", [cat])],
			},
		});
		expect(store.packFollowOf(cat.id)?.rkey).toBe("3pack");
		expect(
			store
				.own()
				.value()
				?.emojis.map((entry) => entry.name),
		).toEqual(["mine"]);
	});
});

describe("emoji image refresh", () => {
	const kek = emoji(SPACE, "kek");
	const refreshed = { ...kek, image: "kek-fresh.png" };

	it("refetches the owner catalog once for concurrent failures of one link", async () => {
		const { store, source } = setup({
			own: catalogOf(VIEWER, []),
			follows: [],
		});
		await warmUp(store);
		const listEmoji = vi.mocked(source.listEmoji);
		const before = listEmoji.mock.calls.length;
		listEmoji.mockResolvedValueOnce(catalogOf(SPACE, [refreshed]));

		const [first, second] = await Promise.all([
			store.refreshImage(kek.id, kek.image),
			store.refreshImage(kek.id, kek.image),
		]);
		expect([first, second]).toEqual([true, true]);
		expect(listEmoji.mock.calls.length - before).toBe(1);
		expect(listEmoji).toHaveBeenLastCalledWith(SPACE);
		expect(store.lookup(kek.id)?.image).toBe("kek-fresh.png");

		await expect(store.refreshImage(kek.id, kek.image)).resolves.toBe(true);
		expect(listEmoji.mock.calls.length - before).toBe(1);
	});

	it("refetches a link again once the spacing has passed", async () => {
		const { store, source } = setup({
			own: catalogOf(VIEWER, []),
			follows: [],
		});
		await warmUp(store);
		const listEmoji = vi.mocked(source.listEmoji);
		listEmoji.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
		try {
			await expect(store.refreshImage(kek.id, kek.image)).resolves.toBe(false);
			const before = listEmoji.mock.calls.length;
			now.mockReturnValue(1_000 + EMOJI_WAKE_SPACING_MS);
			await expect(store.refreshImage(kek.id, kek.image)).resolves.toBe(true);
			expect(listEmoji.mock.calls.length - before).toBe(1);
		} finally {
			now.mockRestore();
		}
	});

	it("gives up when the catalog refetch fails", async () => {
		const { store, source } = setup({
			own: catalogOf(VIEWER, []),
			follows: [],
		});
		await warmUp(store);
		const listEmoji = vi.mocked(source.listEmoji);
		listEmoji.mockRejectedValueOnce(new TypeError("Failed to fetch"));

		await expect(store.refreshImage(kek.id, kek.image)).resolves.toBe(false);
		expect(store.lookup(kek.id)?.image).toBe("kek.png");
		await expect(store.refreshImage(kek.id, kek.image)).resolves.toBe(false);
	});
});

describe("emoji availability", () => {
	const kek = emoji(SPACE, "kek");
	const ghost = emoji(SPACE, "ghost");

	it("marks an emoji unavailable once its catalog loads without it", async () => {
		const { store } = setup({ own: catalogOf(VIEWER, []), follows: [] });
		expect(store.availability(SPACE, ghost.id)).toBe("loading");
		await warmUp(store);
		expect(store.availability(SPACE, ghost.id)).toBe("unavailable");
	});

	it("marks an emoji outside the Space's emoji policy unavailable", async () => {
		const { store } = setup(
			{ own: catalogOf(VIEWER, []), follows: [] },
			"none",
		);
		expect(store.availability(SPACE, kek.id)).toBe("unavailable");
		expect(store.availabilityByName(SPACE)).toBe("unavailable");
	});

	it("marks an emoji unavailable after an image refetch drops it", async () => {
		const { store, source } = setup({
			own: catalogOf(VIEWER, []),
			follows: [],
		});
		await warmUp(store);
		vi.mocked(source.listEmoji).mockResolvedValueOnce(catalogOf(SPACE, []));
		await expect(store.refreshImage(kek.id, kek.image)).resolves.toBe(false);
		expect(store.lookup(kek.id)).toBeUndefined();
		expect(store.availability(SPACE, kek.id)).toBe("unavailable");
	});

	it("retries a failed catalog after a delay and recovers", async () => {
		vi.useFakeTimers();
		try {
			const { store, source } = setup({
				own: catalogOf(VIEWER, []),
				follows: [],
			});
			const listEmoji = vi.mocked(source.listEmoji);
			listEmoji.mockRejectedValueOnce(new TypeError("Failed to fetch"));
			store.catalog(SPACE);
			await vi.advanceTimersByTimeAsync(0);
			expect(store.catalog(SPACE).error()).toBeDefined();
			const before = listEmoji.mock.calls.length;
			expect(store.availability(SPACE, kek.id)).toBe("loading");
			expect(store.availabilityByName(SPACE)).toBe("loading");
			await vi.advanceTimersByTimeAsync(EMOJI_RETRY_DELAYS_MS[0] ?? 0);
			expect(listEmoji.mock.calls.length - before).toBe(1);
			expect(store.lookup(kek.id)?.image).toBe("kek.png");
		} finally {
			vi.useRealTimers();
		}
	});

	it("shows unavailable after a second failure and keeps retrying with backoff", async () => {
		vi.useFakeTimers();
		try {
			const { store, source } = setup({
				own: catalogOf(VIEWER, []),
				follows: [],
			});
			const listEmoji = vi.mocked(source.listEmoji);
			listEmoji.mockRejectedValueOnce(new TypeError("Failed to fetch"));
			listEmoji.mockRejectedValueOnce(new TypeError("Failed to fetch"));
			store.catalog(SPACE);
			await vi.advanceTimersByTimeAsync(0);
			expect(store.availability(SPACE, kek.id)).toBe("loading");
			await vi.advanceTimersByTimeAsync(EMOJI_RETRY_DELAYS_MS[0] ?? 0);
			expect(store.availability(SPACE, kek.id)).toBe("unavailable");
			expect(store.availability(SPACE, ghost.id)).toBe("unavailable");
			const before = listEmoji.mock.calls.length;
			await vi.advanceTimersByTimeAsync((EMOJI_RETRY_DELAYS_MS[1] ?? 0) - 1);
			expect(listEmoji.mock.calls.length).toBe(before);
			await vi.advanceTimersByTimeAsync(1);
			expect(listEmoji.mock.calls.length - before).toBe(1);
			expect(store.lookup(kek.id)?.image).toBe("kek.png");
		} finally {
			vi.useRealTimers();
		}
	});

	it("retries a failed catalog right away when the network comes back", async () => {
		const target = new EventTarget();
		vi.stubGlobal("window", target);
		try {
			const { store, source } = setup({
				own: catalogOf(VIEWER, []),
				follows: [],
			});
			const listEmoji = vi.mocked(source.listEmoji);
			listEmoji.mockRejectedValueOnce(new TypeError("Failed to fetch"));
			store.catalog(SPACE);
			await flush();
			const before = listEmoji.mock.calls.length;
			target.dispatchEvent(new Event("online"));
			await flush();
			expect(listEmoji.mock.calls.length - before).toBe(1);
			expect(store.lookup(kek.id)?.image).toBe("kek.png");
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
