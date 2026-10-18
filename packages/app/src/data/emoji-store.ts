import type {
	CustomEmojiSuggestion,
	EmojiPack,
	RichTextCustomEmoji,
} from "@colibri-social/ui";
import { type Accessor, batch, createRoot, createSignal } from "solid-js";
import {
	allowsEmojiUri,
	attachEmojiFacets,
	type EmojiCatalogView,
	type EmojiFollowView,
	type EmojiLibraryView,
	type EmojiOwner,
	type EmojiPackView,
	type EmojiView,
	emojiPolicy,
	emojiRegistry,
	filterEmojiFacets,
	followOf,
	packEmoji,
	packFollowOf,
	readEmojiFeature,
	type UpdateEmojiPackInput,
	ungroupedEmoji,
} from "./emoji";
import type { DataSource } from "./source";
import type { CommunityView, CustomEmojiPolicy, Did, Facet } from "./types";

export type EmojiLoad<T> = {
	value: Accessor<T | undefined>;
	loading: Accessor<boolean>;
	error: Accessor<unknown>;
	refresh: () => Promise<void>;
	set: (next: T) => void;
};

export type EmojiCatalog = EmojiLoad<EmojiCatalogView>;

export type EmojiLibrary = EmojiLoad<EmojiLibraryView>;

const createLoad = <T>(fetch: () => Promise<T>): EmojiLoad<T> =>
	createRoot(() => {
		const [value, setValue] = createSignal<T>();
		const [loading, setLoading] = createSignal(true);
		const [error, setError] = createSignal<unknown>();
		let generation = 0;
		const refresh = async () => {
			const current = ++generation;
			setLoading(true);
			try {
				const next = await fetch();
				if (current !== generation) return;
				batch(() => {
					setValue(() => next);
					setError(undefined);
				});
			} catch (failure) {
				if (current === generation) setError(() => failure);
			} finally {
				if (current === generation) setLoading(false);
			}
		};
		void refresh();
		return {
			value,
			loading,
			error,
			refresh,
			set: (next) => {
				generation++;
				batch(() => {
					setValue(() => next);
					setLoading(false);
				});
			},
		};
	});

export const pickerPacks = (
	catalog: EmojiCatalogView | undefined,
	ungroupedName: string,
): EmojiPack[] => {
	if (!catalog) return [];
	const toCustom = (emoji: EmojiView) => ({
		id: emoji.id,
		name: emoji.name,
		src: emoji.image,
	});
	const packs: EmojiPack[] = catalog.packs
		.map((pack) => ({
			id: pack.id,
			name: pack.name,
			emojis: packEmoji(catalog, pack).map(toCustom),
		}))
		.filter((pack) => pack.emojis.length > 0);
	const loose = ungroupedEmoji(catalog);
	if (loose.length > 0) {
		packs.unshift({
			id: `ungrouped:${catalog.community}`,
			name: ungroupedName,
			emojis: loose.map(toCustom),
		});
	}
	return packs;
};

export const OWN_EMOJI_LABEL = "Your emoji";

export const FOLLOWED_SINGLES_LABEL = "Followed emoji";

export const emojiOwnerName = (owner: EmojiOwner) =>
	owner.displayName || owner.handle || "Someone on Colibri";

export const followedScope = (
	follows: readonly EmojiFollowView[],
): EmojiScopeEntry[] => {
	const available = follows.filter((follow) => follow.state === "available");
	const packs = available
		.filter((follow) => follow.kind === "pack" && follow.pack)
		.map(
			(follow): EmojiScopeEntry => ({
				id: `follow:${follow.subject}`,
				label: follow.pack?.name ?? "",
				author: emojiOwnerName(follow.owner),
				catalog: {
					community: follow.owner.did,
					emojis: follow.emojis,
					packs: [],
				},
				local: false,
			}),
		);
	const singles = available
		.filter((follow) => follow.kind === "emoji")
		.flatMap((follow) => follow.emojis);
	if (singles.length === 0) return packs;
	return [
		...packs,
		{
			id: "follow:emoji",
			label: FOLLOWED_SINGLES_LABEL,
			catalog: {
				community: "" as Did,
				emojis: singles,
				packs: [],
			},
			local: false,
		},
	];
};

export type EmojiScopeEntry = {
	id: string;
	label: string;
	author?: string;
	catalog: EmojiCatalogView | undefined;
	local: boolean;
};

export const createEmojiStore = (
	source: DataSource,
	viewer: () => Did,
	communities: () => readonly CommunityView[] = () => [],
) => {
	const catalogs = new Map<Did, EmojiCatalog>();

	const catalog = (community: Did) => {
		const existing = catalogs.get(community);
		if (existing) return existing;
		const created = createLoad(() => source.listEmoji(community));
		catalogs.set(community, created);
		return created;
	};

	let libraryLoad: EmojiLibrary | undefined;
	const library = () => {
		libraryLoad ??= createLoad(() => source.getEmojiLibrary());
		return libraryLoad;
	};

	const patchLibrary = (
		change: (current: EmojiLibraryView) => EmojiLibraryView,
	) => {
		const current = libraryLoad?.value();
		if (libraryLoad && current) libraryLoad.set(change(current));
	};

	source.subscribe((event) => {
		if (event.$type === "emojiLibraryEvent") {
			library().set(event.library);
			catalogs.get(viewer())?.set(event.library.own);
			return;
		}
		if (event.$type !== "emojiEvent") return;
		catalogs.get(event.catalog.community)?.set(event.catalog);
		if (event.catalog.community === viewer())
			patchLibrary((current) => ({ ...current, own: event.catalog }));
	});

	const patch = (
		community: Did,
		change: (current: EmojiCatalogView) => EmojiCatalogView,
	) => {
		const entry = catalogs.get(community);
		const current = entry?.value();
		if (entry && current) entry.set(change(current));
	};

	const withEmoji = (current: EmojiCatalogView, emoji: EmojiView) => ({
		...current,
		emojis: current.emojis.some((entry) => entry.id === emoji.id)
			? current.emojis.map((entry) => (entry.id === emoji.id ? emoji : entry))
			: [...current.emojis, emoji],
	});

	const withPack = (current: EmojiCatalogView, pack: EmojiPackView) => ({
		...current,
		packs: current.packs.some((entry) => entry.id === pack.id)
			? current.packs.map((entry) => (entry.id === pack.id ? pack : entry))
			: [...current.packs, pack],
	});

	const own = () => catalog(viewer());

	const follows = () => library().value()?.follows ?? [];

	const communityOf = (did: Did) =>
		communities().find((entry) => entry.did === did);

	const policy = (community: Did): CustomEmojiPolicy =>
		emojiPolicy(communityOf(community)?.customEmoji);

	const allows = (community: Did | undefined, uri: string) =>
		!community || allowsEmojiUri(policy(community), community, uri);

	const personal = (): EmojiScopeEntry[] => [
		{
			id: `own:${viewer()}`,
			label: OWN_EMOJI_LABEL,
			catalog: own().value() ?? library().value()?.own,
			local: false,
		},
		...followedScope(follows()),
	];

	const scope = (community: Did | undefined): EmojiScopeEntry[] => {
		if (!community) return personal();
		const level = policy(community);
		if (level === "none") return [];
		const own: EmojiScopeEntry = {
			id: community,
			label: communityOf(community)?.name ?? "",
			catalog: catalog(community).value(),
			local: true,
		};
		if (level === "local") return [own];
		const others = communities()
			.filter((entry) => entry.did !== community)
			.map(
				(entry): EmojiScopeEntry => ({
					id: entry.did,
					label: entry.name,
					catalog: catalog(entry.did).value(),
					local: false,
				}),
			);
		return [own, ...personal(), ...others];
	};

	const available = (community: Did | undefined) => {
		const seen = new Set<string>();
		const rows: { emoji: EmojiView; label: string; entry: string }[] = [];
		for (const entry of scope(community)) {
			for (const emoji of entry.catalog?.emojis ?? []) {
				if (seen.has(emoji.id)) continue;
				seen.add(emoji.id);
				rows.push({ emoji, label: entry.label, entry: entry.id });
			}
		}
		return rows;
	};

	const find = (community: Did | undefined, name: string) =>
		available(community).find((row) => row.emoji.name === name)?.emoji;

	const lookup = (id: string) => {
		for (const entry of catalogs.values()) {
			const match = entry.value()?.emojis.find((emoji) => emoji.id === id);
			if (match) return match;
		}
		for (const follow of follows()) {
			const match = follow.emojis.find((emoji) => emoji.id === id);
			if (match) return match;
		}
		return undefined;
	};

	const search = (community: Did | undefined, query: string, limit: number) => {
		const needle = query.toLowerCase();
		return available(community)
			.filter((row) => row.emoji.name.includes(needle))
			.sort(
				(a, b) =>
					Number(!a.emoji.name.startsWith(needle)) -
					Number(!b.emoji.name.startsWith(needle)),
			)
			.slice(0, limit)
			.map((row) => suggestion(row.emoji, row.label));
	};

	const packs = (community: Did | undefined): EmojiPack[] => {
		const shown = new Set<string>();
		const result: EmojiPack[] = [];
		for (const entry of scope(community)) {
			const view = entry.catalog;
			if (!view) continue;
			const fresh = view.emojis.filter((emoji) => !shown.has(emoji.id));
			for (const emoji of fresh) shown.add(emoji.id);
			if (fresh.length === 0) continue;
			if (entry.local) {
				result.push(...pickerPacks({ ...view, emojis: fresh }, entry.label));
				continue;
			}
			result.push({
				id: `scope:${entry.id}`,
				name: entry.label,
				author: entry.author,
				emojis: fresh.map((emoji) => ({
					id: emoji.id,
					name: emoji.name,
					src: emoji.image,
				})),
			});
		}
		return result;
	};

	const resolve = (community: Did | undefined, uri: string) => {
		if (!emojiRegistry.forUri(uri) || !allows(community, uri)) return undefined;
		return (
			(community
				? catalog(community)
						.value()
						?.emojis.find((emoji) => emoji.id === uri)
				: undefined) ?? lookup(uri)
		);
	};

	const suggestion = (
		emoji: EmojiView,
		sourceLabel?: string,
	): CustomEmojiSuggestion => ({
		id: emoji.id,
		name: emoji.name,
		src: emoji.image,
		source: sourceLabel,
		cid: emoji.ref.cid,
		alt: emojiRegistry.altText(emoji),
		fallback: emojiRegistry.fallbackText(emoji),
	});

	const mention = (
		community: Did | undefined,
		feature: { $type?: string } & Record<string, unknown>,
	): RichTextCustomEmoji | undefined => {
		const target = readEmojiFeature(feature);
		if (!target) return undefined;
		const emoji = resolve(community, target.uri);
		if (!emoji) return undefined;
		return {
			id: emoji.id,
			name: emoji.name,
			src: emoji.image,
			alt: emojiRegistry.altText(emoji),
		};
	};

	const withFacets = (
		community: Did | undefined,
		text: string,
		facets: readonly Facet[],
	) => {
		if (!community) return { text, facets: [...facets] };
		return attachEmojiFacets({
			text,
			facets: filterEmojiFacets(facets, (uri) => allows(community, uri)),
			lookup: (name) => find(community, name),
			registry: emojiRegistry,
		});
	};

	const follow = async (subject: string) => {
		const view = await source.followEmoji({ subject });
		patchLibrary((current) => ({
			...current,
			follows: [
				...current.follows.filter((entry) => entry.subject !== subject),
				view,
			],
		}));
		return view;
	};

	const unfollow = async (subject: string) => {
		const existing = followOf(library().value(), subject);
		if (!existing) return;
		await source.unfollowEmoji({ rkey: existing.rkey });
		patchLibrary((current) => ({
			...current,
			follows: current.follows.filter((entry) => entry.rkey !== existing.rkey),
		}));
	};

	return {
		catalog,
		own,
		library,
		follows,
		followOf: (subject: string) => followOf(library().value(), subject),
		packFollowOf: (emoji: string) => packFollowOf(library().value(), emoji),
		follow,
		unfollow,
		policy,
		allows,
		scope,
		packs,
		find,
		lookup,
		search,
		mention,
		resolve,
		suggestion,
		withFacets,
		upload: async (input: {
			community: Did;
			name: string;
			file: File;
			pack?: string;
		}) => {
			const emoji = await source.uploadEmoji(input);
			patch(input.community, (current) => {
				const next = withEmoji(current, emoji);
				if (!input.pack) return next;
				return {
					...next,
					packs: next.packs.map((pack) =>
						pack.id === input.pack && !pack.emojis.includes(emoji.id)
							? { ...pack, emojis: [...pack.emojis, emoji.id] }
							: pack,
					),
				};
			});
			return emoji;
		},
		rename: async (community: Did, emoji: string, name: string) => {
			const updated = await source.renameEmoji({ community, emoji, name });
			patch(community, (current) => ({
				...withEmoji(
					{
						...current,
						emojis: current.emojis.filter(
							(entry) => entry.id !== emoji || entry.id === updated.id,
						),
					},
					updated,
				),
				packs: current.packs.map((pack) => ({
					...pack,
					emojis: pack.emojis.map((id) => (id === emoji ? updated.id : id)),
				})),
			}));
			return updated;
		},
		remove: async (community: Did, emoji: string) => {
			await source.deleteEmoji({ community, emoji });
			patch(community, (current) => ({
				...current,
				emojis: current.emojis.filter((entry) => entry.id !== emoji),
				packs: current.packs.map((pack) => ({
					...pack,
					emojis: pack.emojis.filter((id) => id !== emoji),
				})),
			}));
		},
		createPack: async (community: Did, name: string, emojis: string[]) => {
			const pack = await source.createEmojiPack({ community, name, emojis });
			patch(community, (current) => withPack(current, pack));
			return pack;
		},
		updatePack: async (input: UpdateEmojiPackInput) => {
			const pack = await source.updateEmojiPack(input);
			patch(input.community, (current) => withPack(current, pack));
			return pack;
		},
		removePack: async (community: Did, pack: string) => {
			await source.deleteEmojiPack({ community, pack });
			patch(community, (current) => ({
				...current,
				packs: current.packs.filter((entry) => entry.id !== pack),
			}));
		},
	};
};

export type EmojiStore = ReturnType<typeof createEmojiStore>;
