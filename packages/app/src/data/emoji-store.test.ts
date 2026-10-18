import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type {
	EmojiCatalogView,
	EmojiFollowView,
	EmojiLibraryView,
	EmojiView,
} from "./emoji";
import { createEmojiStore, OWN_EMOJI_LABEL, pickerPacks } from "./emoji-store";
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
