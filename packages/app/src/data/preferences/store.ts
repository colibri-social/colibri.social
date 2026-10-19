import { classifyThrown, createLogger, nextTid } from "@colibri-social/lib";
import { createSignal } from "solid-js";
import { readStoredJSON, writeStoredJSON } from "../persist";
import type { ControlsPreferences } from "../source";
import type { Datetime, Did, GifView } from "../types";
import {
	clientChangeOf,
	controlsOf,
	mergeClient,
	type ResolvedClient,
	resolveClient,
} from "./client";
import {
	type ClientPreferences,
	type ComposerState,
	DEFAULT_PREFERENCES,
	type Mute,
	type MuteSubject,
	type NotificationLevel,
	type PreferenceBackend,
	type Preferences,
	type SettingsChange,
} from "./types";
import { MAX_RECENT_GIFS, muteKey, pruneEmojiUsage } from "./wire";

const log = createLogger("preferences");

export const COMPOSER_WRITE_DELAY = 2000;

export const preferencesSnapshotKey = (did: string) =>
	`colibri:preferences:${did}`;

export type PreferenceStoreOptions = {
	backend: PreferenceBackend;
	controls: ControlsPreferences;
	snapshotKey?: string;
	onScopesRejected?: () => void;
	composerWriteDelay?: number;
};

type Snapshot = { preferences: Partial<Preferences> };

const isSnapshot = (value: unknown): value is Snapshot =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Snapshot).preferences === "object" &&
	(value as Snapshot).preferences !== null;

export const createPreferenceStore = (options: PreferenceStoreOptions) => {
	const { backend } = options;
	const composerDelay = options.composerWriteDelay ?? COMPOSER_WRITE_DELAY;
	const stored = options.snapshotKey
		? readStoredJSON(options.snapshotKey, isSnapshot)
		: undefined;
	const [preferences, setPreferences] = createSignal<Preferences>({
		...DEFAULT_PREFERENCES,
		...stored?.preferences,
	});

	const commit = (next: Preferences) => {
		setPreferences(next);
		if (options.snapshotKey)
			writeStoredJSON(options.snapshotKey, {
				preferences: next,
			} satisfies Snapshot);
	};

	let writes = 0;
	let failed = false;
	let settled: Preferences | undefined;
	let queue: Promise<void> = Promise.resolve();

	const adopt = (next: Preferences) => {
		if (writes === 0) commit(next);
	};

	const refresh = async () => {
		try {
			adopt(await backend.load());
			return true;
		} catch (error) {
			log.warn("could not load preferences", {
				code: classifyThrown(error).code,
			});
			return false;
		}
	};

	const enqueue = (
		what: string,
		run: () => Promise<Preferences>,
	): Promise<boolean> => {
		writes += 1;
		let ok = true;
		queue = queue
			.then(run)
			.then(
				(result) => {
					settled = result;
				},
				(error: unknown) => {
					ok = false;
					failed = true;
					const { code } = classifyThrown(error);
					if (code === "ScopesMissing") options.onScopesRejected?.();
					log.warn(`could not save ${what}`, { code });
				},
			)
			.then(() => {
				writes -= 1;
				if (writes > 0) return;
				const result = settled;
				settled = undefined;
				if (failed) {
					failed = false;
					return refresh().then(() => undefined);
				}
				if (result) commit(result);
			});
		return queue.then(() => ok);
	};

	const update = (change: SettingsChange, what: string) => {
		commit({ ...preferences(), ...change });
		return enqueue(what, () => backend.putSettings(preferences(), change));
	};

	let resolvedFrom: ClientPreferences | undefined;
	let resolved: { client: ResolvedClient; controls: ControlsPreferences };
	const resolve = () => {
		const current = preferences().client;
		if (current !== resolvedFrom) {
			resolvedFrom = current;
			const next = resolveClient(current, options.controls);
			resolved = { client: next, controls: controlsOf(next) };
		}
		return resolved;
	};
	const client = () => resolve().client;
	const controls = () => resolve().controls;
	const setClient = (change: ClientPreferences) =>
		update(
			{ client: mergeClient(preferences().client, change) },
			"app settings",
		);

	let composerTimer: ReturnType<typeof setTimeout> | undefined;
	const flushComposer = () => {
		if (!composerTimer) return Promise.resolve(true);
		clearTimeout(composerTimer);
		composerTimer = undefined;
		writes -= 1;
		return enqueue("emoji and GIF history", () =>
			backend.putSettings(preferences(), {
				composer: preferences().composer,
			}),
		);
	};
	const updateComposer = (next: (current: ComposerState) => ComposerState) => {
		commit({ ...preferences(), composer: next(preferences().composer) });
		if (composerTimer) clearTimeout(composerTimer);
		else writes += 1;
		composerTimer = setTimeout(() => void flushComposer(), composerDelay);
	};

	let keyedMutes: readonly Mute[] | undefined;
	let mutedKeys = new Set<string>();
	const muted = () => {
		const list = preferences().mutes;
		if (list !== keyedMutes) {
			keyedMutes = list;
			mutedKeys = new Set(list.map((mute) => muteKey(mute.subject)));
		}
		return mutedKeys;
	};
	const isMuted = (subject: MuteSubject) => muted().has(muteKey(subject));

	let rkeys: Promise<Map<string, string>> | undefined;
	const muteRkeys = () => {
		rkeys ??= backend.listMutes().then(
			(records) =>
				new Map(
					records.map((record) => [muteKey(record.mute.subject), record.rkey]),
				),
			(error: unknown) => {
				rkeys = undefined;
				throw error;
			},
		);
		return rkeys;
	};

	const setMuted = (subject: MuteSubject, next: boolean) => {
		if (isMuted(subject) === next) return queue.then(() => true);
		const key = muteKey(subject);
		const entry: Mute = {
			subject,
			createdAt: new Date().toISOString() as Datetime,
		};
		const current = preferences().mutes;
		commit({
			...preferences(),
			mutes: next
				? [...current, entry]
				: current.filter((mute) => muteKey(mute.subject) !== key),
		});
		return enqueue("mutes", async () => {
			const known = await muteRkeys();
			const rkey = known.get(key);
			if (next && !rkey) {
				const fresh = nextTid();
				await backend.createMute(fresh, entry);
				known.set(key, fresh);
			}
			if (!next && rkey) {
				await backend.deleteMute(rkey);
				known.delete(key);
			}
			return backend.putMutes(preferences().mutes);
		});
	};

	const setSpaceLevel = (
		community: Did,
		level: NotificationLevel | undefined,
	) => {
		const { [community]: _, ...rest } = preferences().spaceLevels;
		commit({
			...preferences(),
			spaceLevels: level ? { ...rest, [community]: level } : rest,
		});
		return enqueue("the Space notification level", () =>
			backend.putSpaceLevel(community, level),
		);
	};

	const setSpaceModeration = (
		community: Did,
		hideModeratedMessages: boolean | undefined,
	) => {
		const { [community]: _, ...rest } = preferences().spaceModeration;
		commit({
			...preferences(),
			spaceModeration:
				hideModeratedMessages === undefined
					? rest
					: { ...rest, [community]: hideModeratedMessages },
		});
		return enqueue("the Space moderation setting", () =>
			backend.putSpaceModeration(community, hideModeratedMessages),
		);
	};

	const spaceModeration = (community: string): boolean | undefined =>
		preferences().spaceModeration[community];

	return {
		preferences,
		client,
		controls,
		composer: () => preferences().composer,
		notificationLevel: () => preferences().notificationLevel,
		communityOrder: () => preferences().communityOrder,
		shareActivity: () => preferences().shareActivity,
		gifFavorites: () => preferences().gifFavorites,
		spaceLevel: (community: string): NotificationLevel | undefined =>
			preferences().spaceLevels[community],
		setClient,
		setControls: (next: Partial<ControlsPreferences>) =>
			setClient(clientChangeOf(next)),
		setNotificationLevel: (level: NotificationLevel) =>
			update({ notificationLevel: level }, "the notification level"),
		setCommunityOrder: (order: readonly Did[]) =>
			update({ communityOrder: [...order] }, "the Space order"),
		setShareActivity: (share: boolean) =>
			update({ shareActivity: share }, "activity sharing"),
		setGifFavorite: (gif: GifView, favorite: boolean) => {
			const current = preferences().gifFavorites;
			const known = current.some((entry) => entry.id === gif.id);
			const gifFavorites = !favorite
				? current.filter((entry) => entry.id !== gif.id)
				: known
					? current.map((entry) => (entry.id === gif.id ? gif : entry))
					: [...current, gif];
			return update({ gifFavorites }, "GIF favorites");
		},
		setSpaceLevel,
		spaceModeration,
		setSpaceModeration,
		hidesModerated: (community: string) =>
			spaceModeration(community) ?? client().hideModeratedMessages,
		recordEmoji: (emoji: string) =>
			updateComposer((current) => {
				const previous = current.emojiUsage[emoji];
				return {
					...current,
					emojiUsage: pruneEmojiUsage({
						...current.emojiUsage,
						[emoji]: {
							count: (previous?.count ?? 0) + 1,
							lastUsed: Date.now(),
						},
					}),
				};
			}),
		setSkinTone: (skinTone: number) =>
			updateComposer((current) => ({ ...current, skinTone })),
		recordGif: (gif: GifView) =>
			updateComposer((current) => ({
				...current,
				recentGifs: [
					gif,
					...current.recentGifs.filter((entry) => entry.id !== gif.id),
				].slice(0, MAX_RECENT_GIFS),
			})),
		importSettings: (change: SettingsChange) =>
			update(change, "imported settings"),
		isMuted,
		setMuted,
		adopt,
		refresh,
		settled: async () => {
			await flushComposer();
			await queue;
		},
	};
};

export type PreferenceStore = ReturnType<typeof createPreferenceStore>;
