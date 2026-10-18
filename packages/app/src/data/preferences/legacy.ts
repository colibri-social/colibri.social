import { readStored, readStoredJSON, writeStored } from "../persist";
import type { GifView } from "../types";
import { mergeClient } from "./client";
import type { PreferenceStore } from "./store";
import {
	BLUESKY_CLIENTS,
	type ClientPreferences,
	type ComposerState,
	type EmojiUse,
	type Preferences,
	type SettingsChange,
} from "./types";
import { MAX_RECENT_GIFS, pruneEmojiUsage } from "./wire";

export const LEGACY_PREFERENCES_KEY = "colibri:user-preferences";

export const legacyImportMarker = (did: string) =>
	`colibri:preferences-imported:${did}`;

type Blob = Record<string, unknown>;

const isObject = (value: unknown): value is Blob =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const bool = (value: unknown) =>
	typeof value === "boolean" ? value : undefined;

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

const missing = <T extends object>(
	current: T | undefined,
	found: Partial<T>,
): Partial<T> | undefined => {
	const entries = Object.entries(found).filter(
		([key, value]) =>
			value !== undefined && current?.[key as keyof T] === undefined,
	);
	return entries.length > 0
		? (Object.fromEntries(entries) as Partial<T>)
		: undefined;
};

const legacyClient = (
	blob: Blob,
	current: ClientPreferences,
): ClientPreferences | undefined => {
	const controls = isObject(blob.controls) ? blob.controls : {};
	const voice = isObject(blob.voice) ? blob.voice : {};
	const client = str(blob.preferredBlueskyClient);
	const experiments = isObject(blob.experiments)
		? Object.entries(blob.experiments)
				.filter(([, on]) => on === true)
				.map(([id]) => id)
		: [];
	const theme = str(blob.theme);
	const swipe = str(controls.swipeLeftAction);
	const tap = str(controls.doubleTapAction);
	const top = missing<ClientPreferences>(current, {
		theme: theme === "dark" || theme === "light" ? theme : undefined,
		linkEmbedsByDefault: bool(blob.linkEmbedsByDefault),
		warnOnExternalLinks: bool(blob.warnOnExternalLinks),
		blueskyClient:
			client && (BLUESKY_CLIENTS as readonly string[]).includes(client)
				? client
				: undefined,
		customBlueskyClientBase: str(blob.customBlueskyClientBase) || undefined,
		experiments: experiments.length > 0 ? experiments : undefined,
	});
	const nestedControls = missing(current.controls, {
		swipeLeftAction:
			swipe === "members" || swipe === "reply" ? swipe : undefined,
		doubleTapEnabled: bool(controls.doubleTapEnabled),
		doubleTapAction: tap === "react" || tap === "editOrReply" ? tap : undefined,
		doubleTapReactionEmoji: str(controls.doubleTapReactionEmoji) || undefined,
	});
	const voiceView = missing(current.voiceView, {
		confirmJoin: bool(voice.confirmVoiceJoin),
		showNonVideoParticipants: bool(voice.showNonVideoParticipants),
		showOwnCamera: bool(voice.showOwnCamera),
	});
	if (!top && !nestedControls && !voiceView) return undefined;
	return {
		...top,
		...(nestedControls ? { controls: nestedControls } : {}),
		...(voiceView ? { voiceView } : {}),
	};
};

const isEmojiUse = (value: unknown): value is EmojiUse =>
	isObject(value) &&
	typeof value.count === "number" &&
	value.count >= 1 &&
	typeof value.lastUsed === "number";

const isGif = (value: unknown): value is GifView =>
	isObject(value) &&
	typeof value.id === "string" &&
	typeof value.url === "string" &&
	typeof value.previewUrl === "string" &&
	typeof value.width === "number" &&
	typeof value.height === "number";

const legacyComposer = (
	blob: Blob,
	current: ComposerState,
): ComposerState | undefined => {
	const usage =
		Object.keys(current.emojiUsage).length === 0 && isObject(blob.emojiUsage)
			? pruneEmojiUsage(
					Object.fromEntries(
						Object.entries(blob.emojiUsage).filter(([, use]) =>
							isEmojiUse(use),
						),
					) as Record<string, EmojiUse>,
				)
			: {};
	const gifs =
		current.recentGifs.length === 0 && Array.isArray(blob.recentGifs)
			? blob.recentGifs.filter(isGif).slice(0, MAX_RECENT_GIFS)
			: [];
	if (Object.keys(usage).length === 0 && gifs.length === 0) return undefined;
	return {
		...current,
		...(Object.keys(usage).length > 0 ? { emojiUsage: usage } : {}),
		...(gifs.length > 0 ? { recentGifs: gifs } : {}),
	};
};

export const legacyChange = (
	blob: unknown,
	current: Preferences,
): SettingsChange | undefined => {
	if (!isObject(blob)) return undefined;
	const client = legacyClient(blob, current.client);
	const composer = legacyComposer(blob, current.composer);
	if (!client && !composer) return undefined;
	return {
		...(client ? { client: mergeClient(current.client, client) } : {}),
		...(composer ? { composer } : {}),
	};
};

export const importLegacyPreferences = async (
	store: Pick<PreferenceStore, "preferences" | "importSettings">,
	did: string,
) => {
	const marker = legacyImportMarker(did);
	if (readStored(marker)) return;
	const change = legacyChange(
		readStoredJSON(LEGACY_PREFERENCES_KEY, isObject),
		store.preferences(),
	);
	if (change && !(await store.importSettings(change))) return;
	writeStored(marker, "1");
};
