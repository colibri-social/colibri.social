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
	type EmojiPackView,
	type EmojiView,
	emojiPolicy,
	emojiRegistry,
	filterEmojiFacets,
	packEmoji,
	readEmojiFeature,
	sourceOf,
	type UpdateEmojiPackInput,
	ungroupedEmoji,
} from "./emoji";
import type { DataSource } from "./source";
import type { CommunityView, CustomEmojiPolicy, Did, Facet } from "./types";

export type EmojiCatalog = {
	value: Accessor<EmojiCatalogView | undefined>;
	loading: Accessor<boolean>;
	error: Accessor<unknown>;
	refresh: () => Promise<void>;
	set: (next: EmojiCatalogView) => void;
};

const createCatalog = (fetch: () => Promise<EmojiCatalogView>): EmojiCatalog =>
	createRoot(() => {
		const [value, setValue] = createSignal<EmojiCatalogView>();
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

export const followedPickerPacks = (
	space: EmojiCatalogView | undefined,
	followed: EmojiCatalogView | undefined,
	followedName: string,
): EmojiPack[] => {
	if (!followed) return [];
	const local = new Set((space?.emojis ?? []).map((emoji) => emoji.id));
	const visible = followed.emojis.filter(
		(emoji) => !local.has(sourceOf(emoji)),
	);
	if (visible.length === 0) return [];
	return pickerPacks({ ...followed, emojis: visible }, followedName).map(
		(pack) => ({ ...pack, id: `followed:${pack.id}` }),
	);
};

export const FOLLOWED_EMOJI_LABEL = "Your emoji";

export type EmojiScopeEntry = {
	id: string;
	label: string;
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
		const created = createCatalog(() => source.listEmoji(community));
		catalogs.set(community, created);
		return created;
	};

	source.subscribe((event) => {
		if (event.$type !== "emojiEvent") return;
		catalogs.get(event.catalog.community)?.set(event.catalog);
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

	const followed = () => catalog(viewer());

	const communityOf = (did: Did) =>
		communities().find((entry) => entry.did === did);

	const policy = (community: Did): CustomEmojiPolicy =>
		emojiPolicy(communityOf(community)?.customEmoji);

	const allows = (community: Did | undefined, uri: string) =>
		!community || allowsEmojiUri(policy(community), community, uri);

	const scope = (community: Did | undefined): EmojiScopeEntry[] => {
		if (!community) {
			return [
				{
					id: `followed:${viewer()}`,
					label: FOLLOWED_EMOJI_LABEL,
					catalog: followed().value(),
					local: false,
				},
			];
		}
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
		return [
			own,
			...others,
			{
				id: `followed:${viewer()}`,
				label: FOLLOWED_EMOJI_LABEL,
				catalog: followed().value(),
				local: false,
			},
		];
	};

	const available = (community: Did | undefined) => {
		const seen = new Set<string>();
		const rows: { emoji: EmojiView; label: string; entry: string }[] = [];
		for (const entry of scope(community)) {
			for (const emoji of entry.catalog?.emojis ?? []) {
				const key = sourceOf(emoji);
				if (seen.has(key)) continue;
				seen.add(key);
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
		return undefined;
	};

	const search = (community: Did | undefined, query: string, limit: number) => {
		const needle = query.toLowerCase();
		const seen = new Set<string>();
		return available(community)
			.filter((row) => row.emoji.name.includes(needle))
			.sort(
				(a, b) =>
					Number(!a.emoji.name.startsWith(needle)) -
					Number(!b.emoji.name.startsWith(needle)),
			)
			.filter((row) => {
				if (seen.has(row.emoji.name)) return false;
				seen.add(row.emoji.name);
				return true;
			})
			.slice(0, limit)
			.map((row) => suggestion(row.emoji, row.label));
	};

	const packs = (community: Did | undefined): EmojiPack[] => {
		const shown = new Set<string>();
		const result: EmojiPack[] = [];
		for (const entry of scope(community)) {
			const view = entry.catalog;
			if (!view) continue;
			const fresh = view.emojis.filter((emoji) => !shown.has(sourceOf(emoji)));
			for (const emoji of fresh) shown.add(sourceOf(emoji));
			if (fresh.length === 0) continue;
			if (entry.local) {
				result.push(...pickerPacks({ ...view, emojis: fresh }, entry.label));
				continue;
			}
			result.push({
				id: `scope:${entry.id}`,
				name: entry.label,
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

	return {
		catalog,
		followed,
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
		follow: (emoji: string) => source.followEmoji({ emoji }),
		unfollow: (emoji: string) => source.unfollowEmoji({ emoji }),
		followPack: (community: Did, pack: string) =>
			source.followEmojiPack({ community, pack }),
		unfollowPack: (community: Did, pack: string) =>
			source.unfollowEmojiPack({ community, pack }),
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
