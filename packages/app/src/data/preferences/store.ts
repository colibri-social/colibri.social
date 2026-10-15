import { classifyThrown, createLogger, nextTid } from "@colibri-social/lib";
import { createSignal } from "solid-js";
import { readStoredJSON, writeStoredJSON } from "../persist";
import type { ControlsPreferences } from "../source";
import type { Datetime, Did, GifView } from "../types";
import {
	DEFAULT_PREFERENCES,
	type Mute,
	type MuteSubject,
	type NotificationLevel,
	type PreferenceBackend,
	type Preferences,
	type SettingsChange,
	type SettingsRecord,
} from "./types";
import { muteKey } from "./wire";

const log = createLogger("preferences");

export const preferencesSnapshotKey = (did: string) =>
	`colibri:preferences:${did}`;

export type PreferenceStoreOptions = {
	backend: PreferenceBackend;
	controls: ControlsPreferences;
	snapshotKey?: string;
	onScopesRejected?: () => void;
};

type Snapshot = {
	preferences: Partial<Preferences>;
	controls: Partial<ControlsPreferences>;
};

const isSnapshot = (value: unknown): value is Snapshot =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Snapshot).preferences === "object" &&
	typeof (value as Snapshot).controls === "object";

const settingsOf = (preferences: Preferences): SettingsRecord => ({
	notificationLevel: preferences.notificationLevel,
	communityOrder: preferences.communityOrder,
	shareActivity: preferences.shareActivity,
	gifFavorites: preferences.gifFavorites,
});

export const createPreferenceStore = (options: PreferenceStoreOptions) => {
	const { backend } = options;
	const stored = options.snapshotKey
		? readStoredJSON(options.snapshotKey, isSnapshot)
		: undefined;
	const [preferences, setPreferences] = createSignal<Preferences>({
		...DEFAULT_PREFERENCES,
		...stored?.preferences,
	});
	const [controls, setControlsSignal] = createSignal<ControlsPreferences>({
		...options.controls,
		...stored?.controls,
	});

	const save = () => {
		if (!options.snapshotKey) return;
		writeStoredJSON(options.snapshotKey, {
			preferences: preferences(),
			controls: controls(),
		} satisfies Snapshot);
	};
	const commit = (next: Preferences) => {
		setPreferences(next);
		save();
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
		} catch (error) {
			log.warn("could not load preferences", {
				code: classifyThrown(error).code,
			});
		}
	};

	const enqueue = (what: string, run: () => Promise<Preferences>) => {
		writes += 1;
		queue = queue
			.then(run)
			.then(
				(result) => {
					settled = result;
				},
				(error: unknown) => {
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
					return refresh();
				}
				if (result) commit(result);
			});
		return queue;
	};

	const updateSettings = (change: SettingsChange, what: string) => {
		commit({ ...preferences(), ...change });
		return enqueue(what, () =>
			backend.putSettings(settingsOf(preferences()), change),
		);
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
		if (isMuted(subject) === next) return queue;
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

	return {
		preferences,
		controls,
		notificationLevel: () => preferences().notificationLevel,
		communityOrder: () => preferences().communityOrder,
		shareActivity: () => preferences().shareActivity,
		gifFavorites: () => preferences().gifFavorites,
		setControls: (next: Partial<ControlsPreferences>) => {
			setControlsSignal((current) => ({ ...current, ...next }));
			save();
		},
		setNotificationLevel: (level: NotificationLevel) =>
			updateSettings({ notificationLevel: level }, "the notification level"),
		setCommunityOrder: (order: readonly Did[]) =>
			updateSettings({ communityOrder: [...order] }, "the Space order"),
		setShareActivity: (share: boolean) =>
			updateSettings({ shareActivity: share }, "activity sharing"),
		setGifFavorite: (gif: GifView, favorite: boolean) => {
			const current = preferences().gifFavorites;
			const known = current.some((entry) => entry.id === gif.id);
			const gifFavorites = !favorite
				? current.filter((entry) => entry.id !== gif.id)
				: known
					? current.map((entry) => (entry.id === gif.id ? gif : entry))
					: [...current, gif];
			return updateSettings({ gifFavorites }, "GIF favorites");
		},
		isMuted,
		setMuted,
		adopt,
		refresh,
		settled: () => queue,
	};
};

export type PreferenceStore = ReturnType<typeof createPreferenceStore>;
