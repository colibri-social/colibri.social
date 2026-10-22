import {
	type ColibriError,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
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
	getOwner,
	onCleanup,
	type Setter,
	untrack,
} from "solid-js";
import {
	allowsEmojiUri,
	attachEmojiFacets,
	EMOJI_BATCH_LIMIT,
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
	failures: Accessor<number>;
	refresh: () => Promise<void>;
	set: (next: T) => void;
};

export type EmojiCatalog = EmojiLoad<EmojiCatalogView>;

export type EmojiAvailability = "loading" | "unavailable";

export type EmojiLibrary = EmojiLoad<EmojiLibraryView>;

type LoadHooks = {
	onChange?: () => void;
	onSettle?: (failed: boolean, refresh: () => Promise<void>) => void;
};

const createLoad = <T>(
	fetch: () => Promise<T>,
	seed?: T,
	hooks: LoadHooks = {},
): EmojiLoad<T> =>
	createRoot(() => {
		const [value, setValue] = createSignal<T | undefined>(seed);
		const [loading, setLoading] = createSignal(true);
		const [error, setError] = createSignal<unknown>();
		const [failures, setFailures] = createSignal(0);
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
					setFailures(0);
				});
				hooks.onChange?.();
				hooks.onSettle?.(false, refresh);
			} catch (failure) {
				if (current !== generation) return;
				batch(() => {
					setError(() => failure);
					setFailures((count) => count + 1);
				});
				hooks.onSettle?.(true, refresh);
			} finally {
				if (current === generation) setLoading(false);
			}
		};
		void refresh();
		return {
			value,
			loading,
			error,
			failures,
			refresh,
			set: (next) => {
				generation++;
				batch(() => {
					setValue(() => next);
					setError(undefined);
					setFailures(0);
					setLoading(false);
				});
				hooks.onChange?.();
				hooks.onSettle?.(false, refresh);
			},
		};
	});

export const EMOJI_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

export const EMOJI_WAKE_SPACING_MS = 5_000;

type RetryEntry = {
	attempt: number;
	timer?: ReturnType<typeof setTimeout>;
	run: () => void;
};

const createRetries = (now: () => number = Date.now) => {
	const entries = new Map<string, RetryEntry>();
	let lastWake = Number.NEGATIVE_INFINITY;
	const fire = (entry: RetryEntry) => {
		clearTimeout(entry.timer);
		entry.timer = undefined;
		entry.run();
	};
	return {
		schedule: (key: string, run: () => void) => {
			const entry = entries.get(key) ?? { attempt: 0, run };
			entry.run = run;
			clearTimeout(entry.timer);
			const delay = EMOJI_RETRY_DELAYS_MS[entry.attempt];
			entry.attempt += 1;
			entry.timer =
				delay === undefined ? undefined : setTimeout(() => fire(entry), delay);
			entries.set(key, entry);
		},
		settle: (key: string) => {
			const entry = entries.get(key);
			if (!entry) return;
			clearTimeout(entry.timer);
			entries.delete(key);
		},
		wake: () => {
			const at = now();
			if (at - lastWake < EMOJI_WAKE_SPACING_MS) return;
			lastWake = at;
			for (const entry of [...entries.values()]) fire(entry);
		},
		dispose: () => {
			for (const entry of entries.values()) clearTimeout(entry.timer);
			entries.clear();
		},
	};
};

const GET_EMOJIS_METHOD = "emoji.getEmojis";

const batchRejected = (error: ColibriError) =>
	error.status === 501 ||
	error.status === 404 ||
	error.context.unknownCode === "MethodNotImplemented" ||
	error.code === "ScopesMissing" ||
	error.code === "Forbidden";

type Sighting =
	| { kind: "pending" }
	| { kind: "found"; emoji: EmojiView }
	| { kind: "missing" }
	| { kind: "failed"; failures: number }
	| { kind: "catalog" };

export const EMOJI_SEED_LIMIT = 500;

export type EmojiSeed = {
	library?: EmojiLibraryView;
	catalogs?: Readonly<Record<string, EmojiCatalogView>>;
	emojis?: Readonly<Record<string, EmojiView>>;
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
	const sightings = new Map<string, [Accessor<Sighting>, Setter<Sighting>]>();
	const retries = createRetries();

	if (typeof window !== "undefined") {
		window.addEventListener("online", retries.wake);
		window.addEventListener("focus", retries.wake);
		if (getOwner())
			onCleanup(() => {
				window.removeEventListener("online", retries.wake);
				window.removeEventListener("focus", retries.wake);
				retries.dispose();
			});
	}

	const foundEmoji = () => {
		const found: Record<string, EmojiView> = {};
		for (const [uri, [read]] of sightings) {
			const seen = untrack(read);
			if (seen.kind === "found") found[uri] = seen.emoji;
		}
		return Object.fromEntries(Object.entries(found).slice(-EMOJI_SEED_LIMIT));
	};

	const loaded = (): EmojiSeed => {
		const views: Record<string, EmojiCatalogView> = {};
		for (const [community, load] of catalogs) {
			const view = untrack(load.value);
			if (view) views[community] = view;
		}
		return {
			library: libraryLoad && untrack(libraryLoad.value),
			catalogs: views,
			emojis: foundEmoji(),
		};
	};

	const offer = () => cache.offer?.(loaded());

	const retrying =
		(key: string, method: string) =>
		(failed: boolean, refresh: () => Promise<void>) => {
			if (!failed) {
				retries.settle(key);
				return;
			}
			retries.schedule(key, () => {
				void refresh().then(() => {
					const load =
						key === "library" ? libraryLoad : catalogs.get(key as Did);
					const failure = load && untrack(load.error);
					if (failure)
						log.warn("emoji retry failed", {
							code: classifyThrown(failure, { method }).code,
						});
				});
			});
		};

	const catalog = (community: Did) => {
		const existing = catalogs.get(community);
		if (existing) return existing;
		const created = createLoad(
			() => source.listEmoji(community),
			cache.seed?.catalogs?.[community],
			{ onChange: offer, onSettle: retrying(community, "emoji.getCatalog") },
		);
		catalogs.set(community, created);
		return created;
	};

	const library = () => {
		libraryLoad ??= createLoad(
			() => source.getEmojiLibrary(),
			cache.seed?.library,
			{ onChange: offer, onSettle: retrying("library", "emoji.getLibrary") },
		);
		return libraryLoad;
	};

	let batchUnsupported = !source.getEmojis;
	let nextFlush: { uris: Set<string>; done: Promise<void> } | undefined;

	const setSighting = (uri: string, next: Sighting) =>
		sightings.get(uri)?.[1](next);

	const sightingOf = (uri: string) => sightings.get(uri)?.[0];

	const retryKey = (uri: string) => `emoji ${uri}`;

	const toCatalog = (uris: readonly string[]) =>
		batch(() => {
			for (const uri of uris) {
				retries.settle(retryKey(uri));
				setSighting(uri, { kind: "catalog" });
			}
		});

	const markFailed = (uri: string) => {
		const current = sightingOf(uri);
		const seen = current && untrack(current);
		if (seen?.kind === "found") return;
		setSighting(uri, {
			kind: "failed",
			failures: seen?.kind === "failed" ? seen.failures + 1 : 1,
		});
		retries.schedule(retryKey(uri), () => void enqueue(uri));
	};

	const requestBatch = async (uris: readonly string[]) => {
		const getEmojis = source.getEmojis;
		if (!getEmojis || batchUnsupported) {
			toCatalog(uris);
			return;
		}
		try {
			const result = await getEmojis(uris);
			const found = new Map(result.emojis.map((emoji) => [emoji.id, emoji]));
			const unreachable = new Set<string>(result.unreachable);
			batch(() => {
				for (const uri of uris) {
					const emoji = found.get(uri);
					if (emoji) {
						retries.settle(retryKey(uri));
						setSighting(uri, { kind: "found", emoji });
					} else if (unreachable.has(repoOfUri(uri) ?? "")) {
						markFailed(uri);
					} else {
						retries.settle(retryKey(uri));
						setSighting(uri, { kind: "missing" });
					}
				}
			});
			if (found.size > 0) offer();
		} catch (thrown) {
			const failure = classifyThrown(thrown, { method: GET_EMOJIS_METHOD });
			log.warn("emoji batch failed", { code: failure.code });
			if (batchRejected(failure)) batchUnsupported = true;
			if (batchUnsupported || !failure.retryable) {
				toCatalog(uris);
				return;
			}
			batch(() => {
				for (const uri of uris) markFailed(uri);
			});
		}
	};

	const enqueue = (uri: string): Promise<void> => {
		if (!nextFlush) {
			const uris = new Set<string>();
			const done = new Promise<void>((resolve) =>
				queueMicrotask(() => {
					nextFlush = undefined;
					const list = [...uris];
					const work: Promise<void>[] = [];
					for (let at = 0; at < list.length; at += EMOJI_BATCH_LIMIT)
						work.push(requestBatch(list.slice(at, at + EMOJI_BATCH_LIMIT)));
					void Promise.all(work).then(() => resolve());
				}),
			);
			nextFlush = { uris, done };
		}
		nextFlush.uris.add(uri);
		return nextFlush.done;
	};

	const sighting = (uri: string, owner: Did): Accessor<Sighting> => {
		const existing = sightingOf(uri);
		if (existing) return existing;
		const seeded = cache.seed?.emojis?.[uri];
		const first: Sighting =
			batchUnsupported || catalogs.has(owner)
				? { kind: "catalog" }
				: seeded
					? { kind: "found", emoji: seeded }
					: { kind: "pending" };
		const created = createSignal<Sighting>(first);
		sightings.set(uri, created);
		if (first.kind !== "catalog") void enqueue(uri);
		return created[0];
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
		batch(() => {
			for (const [uri, [read, write]] of sightings) {
				if (repoOfUri(uri) !== event.catalog.community) continue;
				const kind = untrack(read).kind;
				if (kind !== "found" && kind !== "missing") continue;
				const emoji = emojiIn(event.catalog.emojis, uri);
				write(emoji ? { kind: "found", emoji } : { kind: "missing" });
			}
		});
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
				() => {
					const known = loadedEmoji(uri, owner);
					if (known || !owner) return known;
					const seen = sighting(uri, owner)();
					if (seen.kind === "found") return seen.emoji;
					if (seen.kind === "catalog")
						return emojiIn(catalog(owner).value()?.emojis, uri);
					return undefined;
				},
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

	const imageRefreshes = new Map<
		string,
		{ work: Promise<boolean>; settledAt?: number }
	>();

	const reloadCatalog = async (uri: string, load: EmojiCatalog) => {
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

	const reloadImage = async (uri: string) => {
		const seen = sightingOf(uri);
		const kind = seen && untrack(seen).kind;
		if (kind && kind !== "catalog" && !batchUnsupported) {
			await enqueue(uri);
			const after = sightingOf(uri);
			if (after && untrack(after).kind !== "catalog")
				return untrack(emojiByUri(uri)) !== undefined;
		}
		const load = ownerCatalog(uri);
		return load ? reloadCatalog(uri, load) : false;
	};

	const refreshImage = (uri: string, src: string): Promise<boolean> => {
		const existing = imageRefreshes.get(src);
		if (
			existing &&
			(existing.settledAt === undefined ||
				Date.now() - existing.settledAt < EMOJI_WAKE_SPACING_MS)
		)
			return existing.work;
		const entry: { work: Promise<boolean>; settledAt?: number } = {
			work: reloadImage(uri).finally(() => {
				entry.settledAt = Date.now();
			}),
		};
		imageRefreshes.set(src, entry);
		return entry.work;
	};

	const settle = (load: EmojiCatalog): EmojiAvailability => {
		if (load.loading() || libraryLoad?.loading()) return "loading";
		if (load.error() === undefined) return "unavailable";
		return load.failures() > 1 ? "unavailable" : "loading";
	};

	const availability = (
		community: Did | undefined,
		uri: string,
	): EmojiAvailability => {
		if (!emojiRegistry.forUri(uri) || !allows(community, uri))
			return "unavailable";
		const owner = repoOfUri(uri);
		if (!owner) return "unavailable";
		if (loadedEmoji(uri, owner)) return "unavailable";
		const seen = sighting(uri, owner)();
		if (seen.kind === "catalog") return settle(catalog(owner));
		if (libraryLoad?.loading()) return "loading";
		if (seen.kind === "pending") return "loading";
		if (seen.kind === "failed")
			return seen.failures > 1 ? "unavailable" : "loading";
		return "unavailable";
	};

	const availabilityByName = (
		community: Did | undefined,
	): EmojiAvailability => {
		if (!community) return libraryLoad?.loading() ? "loading" : "unavailable";
		if (policy(community) === "none") return "unavailable";
		return settle(catalog(community));
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
		return availability(community, target.uri) === "loading"
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
