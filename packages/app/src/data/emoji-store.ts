import { classifyThrown, createLogger } from "@colibri-social/lib";
import type {
	CustomEmojiSuggestion,
	EmojiPack,
	RichTextCustomEmoji,
} from "@colibri-social/ui";
import {
	type Accessor,
	batch,
	createMemo,
	createRoot,
	createSignal,
	untrack,
} from "solid-js";
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
	repoOfUri,
	sortedEmoji,
	type UpdateEmojiPackInput,
	ungroupedEmoji,
} from "./emoji";
import type { DataSource } from "./source";
import type { CommunityView, CustomEmojiPolicy, Did, Facet } from "./types";

const log = createLogger("emoji-store");

export type EmojiLoad<T> = {
	value: Accessor<T | undefined>;
	loading: Accessor<boolean>;
	error: Accessor<unknown>;
	refresh: () => Promise<void>;
	set: (next: T) => void;
};

export type EmojiCatalog = EmojiLoad<EmojiCatalogView>;

export type EmojiAvailability = "loading" | "unavailable";

export type EmojiLibrary = EmojiLoad<EmojiLibraryView>;

const createLoad = <T>(
	fetch: () => Promise<T>,
	seed?: T,
	onChange?: () => void,
): EmojiLoad<T> =>
	createRoot(() => {
		const [value, setValue] = createSignal<T | undefined>(seed);
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
				onChange?.();
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
				onChange?.();
			},
		};
	});

export type EmojiSeed = {
	library?: EmojiLibraryView;
	catalogs?: Readonly<Record<string, EmojiCatalogView>>;
};

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

export const emojiOwnerName = (owner: EmojiOwner) =>
	owner.displayName || owner.handle || "Someone on Colibri";

export const emojiAuthorName = (owner: EmojiOwner) =>
	owner.displayName ||
	(owner.handle ? `@${owner.handle}` : emojiOwnerName(owner));

export type FollowOrigin = {
	listed: (owner: Did) => boolean;
	packOf: (emoji: EmojiView) => EmojiPackView | undefined;
	ownerLabel: (owner: EmojiOwner) => string;
};

export const followedScope = (
	follows: readonly EmojiFollowView[],
	origin: FollowOrigin,
): EmojiScopeEntry[] => {
	const available = follows.filter((follow) => follow.state === "available");
	const packs = available
		.filter((follow) => follow.kind === "pack" && follow.pack)
		.map(
			(follow): EmojiScopeEntry => ({
				id: `follow:${follow.subject}`,
				label: follow.pack?.name ?? "",
				author: emojiAuthorName(follow.owner),
				catalog: {
					community: follow.owner.did,
					emojis: sortedEmoji(follow.emojis),
					packs: [],
				},
				grouped: false,
			}),
		);
	const sections = new Map<string, EmojiScopeEntry>();
	for (const follow of available) {
		if (follow.kind !== "emoji" || origin.listed(follow.owner.did)) continue;
		for (const emoji of follow.emojis) {
			const pack = origin.packOf(emoji);
			const id = pack ? `origin:${pack.id}` : `origin:${follow.owner.did}`;
			const existing = sections.get(id);
			if (existing?.catalog) {
				existing.catalog.emojis.push(emoji);
				continue;
			}
			sections.set(id, {
				id,
				label: pack ? pack.name : origin.ownerLabel(follow.owner),
				author: pack ? emojiAuthorName(follow.owner) : undefined,
				catalog: { community: follow.owner.did, emojis: [emoji], packs: [] },
				grouped: false,
			});
		}
	}
	const origins = [...sections.values()].map((entry) => ({
		...entry,
		catalog: entry.catalog && {
			...entry.catalog,
			emojis: sortedEmoji(entry.catalog.emojis),
		},
	}));
	return [...packs, ...origins];
};

const sameEmoji = (a: EmojiView | undefined, b: EmojiView | undefined) =>
	a === b ||
	(!!a &&
		!!b &&
		a.id === b.id &&
		a.name === b.name &&
		a.image === b.image &&
		a.alt === b.alt &&
		a.fallback === b.fallback &&
		a.ref.cid === b.ref.cid);

const emojiIn = (emojis: readonly EmojiView[] | undefined, uri: string) =>
	emojis?.find((emoji) => emoji.id === uri);

export type EmojiScopeEntry = {
	id: string;
	label: string;
	author?: string;
	catalog: EmojiCatalogView | undefined;
	grouped: boolean;
};

export const createEmojiStore = (
	source: DataSource,
	viewer: () => Did,
	communities: () => readonly CommunityView[] = () => [],
	cache: { seed?: EmojiSeed; offer?: (emoji: EmojiSeed) => void } = {},
) => {
	const catalogs = new Map<Did, EmojiCatalog>();
	let libraryLoad: EmojiLibrary | undefined;

	const loaded = (): EmojiSeed => {
		const views: Record<string, EmojiCatalogView> = {};
		for (const [community, load] of catalogs) {
			const view = untrack(load.value);
			if (view) views[community] = view;
		}
		return {
			library: libraryLoad && untrack(libraryLoad.value),
			catalogs: views,
		};
	};

	const offer = () => cache.offer?.(loaded());

	const catalog = (community: Did) => {
		const existing = catalogs.get(community);
		if (existing) return existing;
		const created = createLoad(
			() => source.listEmoji(community),
			cache.seed?.catalogs?.[community],
			offer,
		);
		catalogs.set(community, created);
		return created;
	};

	const library = () => {
		libraryLoad ??= createLoad(
			() => source.getEmojiLibrary(),
			cache.seed?.library,
			offer,
		);
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

	const packOf = (emoji: EmojiView) =>
		catalog(emoji.ref.owner)
			.value()
			?.packs.find((pack) => pack.emojis.includes(emoji.id));

	const ownerLabel = (owner: EmojiOwner) =>
		communityOf(owner.did)?.name ?? emojiAuthorName(owner);

	const personal = (listed: readonly Did[] = []): EmojiScopeEntry[] => [
		{
			id: `own:${viewer()}`,
			label: OWN_EMOJI_LABEL,
			catalog: own().value() ?? library().value()?.own,
			grouped: true,
		},
		...followedScope(follows(), {
			listed: (owner) => listed.includes(owner),
			packOf,
			ownerLabel,
		}),
	];

	const scope = (community: Did | undefined): EmojiScopeEntry[] => {
		if (!community) return personal();
		const level = policy(community);
		if (level === "none") return [];
		const own: EmojiScopeEntry = {
			id: community,
			label: communityOf(community)?.name ?? "",
			catalog: catalog(community).value(),
			grouped: true,
		};
		if (level === "local") return [own];
		const others = communities()
			.filter((entry) => entry.did !== community)
			.map(
				(entry): EmojiScopeEntry => ({
					id: entry.did,
					label: entry.name,
					catalog: catalog(entry.did).value(),
					grouped: false,
				}),
			);
		return [
			own,
			...personal([community, ...others.map((entry) => entry.id as Did)]),
			...others,
		];
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

	const loadedEmoji = (uri: string, owner: Did) => {
		const fromOwner = emojiIn(catalogs.get(owner)?.value()?.emojis, uri);
		if (fromOwner) return fromOwner;
		if (owner === viewer()) {
			const fromLibrary = emojiIn(library().value()?.own.emojis, uri);
			if (fromLibrary) return fromLibrary;
		}
		for (const follow of follows()) {
			const match = emojiIn(follow.emojis, uri);
			if (match) return match;
		}
		return undefined;
	};

	const resolved = new Map<string, Accessor<EmojiView | undefined>>();

	const emojiByUri = (uri: string): Accessor<EmojiView | undefined> => {
		const existing = resolved.get(uri);
		if (existing) return existing;
		const owner = repoOfUri(uri);
		const created = createRoot(() =>
			createMemo(
				() =>
					loadedEmoji(uri, owner) ??
					(owner ? emojiIn(catalog(owner).value()?.emojis, uri) : undefined),
				undefined,
				{ equals: sameEmoji },
			),
		);
		resolved.set(uri, created);
		return created;
	};

	const lookup = (id: string) => emojiByUri(id)();

	const ownerCatalog = (uri: string) => {
		const owner = repoOfUri(uri);
		return owner ? catalog(owner) : undefined;
	};

	const imageRefreshes = new Map<string, Promise<boolean>>();

	const reloadImage = async (uri: string, load: EmojiCatalog) => {
		await load.refresh();
		const failure = untrack(load.error);
		if (failure) {
			log.warn("emoji image refresh failed", {
				code: classifyThrown(failure, { method: "emoji.getCatalog" }).code,
			});
			return false;
		}
		return untrack(emojiByUri(uri)) !== undefined;
	};

	const refreshImage = (uri: string, src: string): Promise<boolean> => {
		const existing = imageRefreshes.get(src);
		if (existing) return existing;
		const load = ownerCatalog(uri);
		if (!load) return Promise.resolve(false);
		const work = reloadImage(uri, load).finally(() =>
			imageRefreshes.set(src, Promise.resolve(false)),
		);
		imageRefreshes.set(src, work);
		return work;
	};

	const catalogRetries = new Set<Did>();
	const scheduledRetries = new Set<Did>();

	const retryCatalog = (owner: Did, load: EmojiCatalog) => {
		catalogRetries.add(owner);
		scheduledRetries.add(owner);
		queueMicrotask(() => {
			const work = load.refresh();
			scheduledRetries.delete(owner);
			void work.then(() => {
				const failure = untrack(load.error);
				if (!failure) return;
				log.warn("emoji catalog retry failed", {
					code: classifyThrown(failure, { method: "emoji.getCatalog" }).code,
				});
			});
		});
	};

	const settle = (owner: Did, load: EmojiCatalog): EmojiAvailability => {
		if (load.loading() || libraryLoad?.loading()) return "loading";
		if (scheduledRetries.has(owner)) return "loading";
		if (load.error() === undefined) return "unavailable";
		if (catalogRetries.has(owner)) return "unavailable";
		retryCatalog(owner, load);
		return "loading";
	};

	const availability = (
		community: Did | undefined,
		uri: string,
	): EmojiAvailability => {
		if (!emojiRegistry.forUri(uri) || !allows(community, uri))
			return "unavailable";
		const owner = repoOfUri(uri);
		return owner ? settle(owner, catalog(owner)) : "unavailable";
	};

	const availabilityByName = (
		community: Did | undefined,
	): EmojiAvailability => {
		if (!community) return libraryLoad?.loading() ? "loading" : "unavailable";
		if (policy(community) === "none") return "unavailable";
		return settle(community, catalog(community));
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
			if (entry.grouped) {
				result.push(...pickerPacks({ ...view, emojis: fresh }, entry.label));
				continue;
			}
			result.push({
				id: `scope:${entry.id}`,
				name: entry.label,
				author: entry.author,
				emojis: sortedEmoji(fresh).map((emoji) => ({
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
		return emojiByUri(uri)();
	};

	const find = (community: Did | undefined, name: string) => {
		const match = available(community).find(
			(row) => row.emoji.name === name,
		)?.emoji;
		return match && (resolve(community, match.id) ?? match);
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
		if (emoji)
			return {
				id: emoji.id,
				name: emoji.name,
				src: emoji.image,
				alt: emojiRegistry.altText(emoji),
			};
		if (!emojiRegistry.forUri(target.uri) || !allows(community, target.uri))
			return undefined;
		return ownerCatalog(target.uri)?.loading()
			? { id: target.uri, name: "", src: "", pending: true }
			: undefined;
	};

	const reactionShortcode = (community: Did | undefined, uri: string) => {
		if (!community || !allows(community, uri)) return undefined;
		const emoji = available(community).find(
			(row) => row.emoji.id === uri,
		)?.emoji;
		if (!emoji || find(community, emoji.name)?.id !== uri) return undefined;
		return `:${emoji.name}:`;
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
		emojiByUri,
		ownerCatalog,
		search,
		mention,
		reactionShortcode,
		resolve,
		refreshImage,
		availability,
		availabilityByName,
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
