import type { ControlsPreferences } from "../source";
import type { Did } from "../types";
import {
	BLUESKY_CLIENTS,
	type BlueskyClient,
	type ClientPreferences,
	DEFAULT_SOUND_VOLUMES,
	GIF_LOOP_LIMITS,
	INBOX_PRESENTATIONS,
	type InboxPresentation,
	RECORD_EXPLORERS,
	type RecordExplorer,
	type SoundGroup,
	type SoundVolumes,
	THEMES,
	type Theme,
} from "./types";

export type ResolvedClient = {
	theme: Theme;
	messagePreviews: boolean;
	linkEmbedsByDefault: boolean;
	warnOnExternalLinks: boolean;
	blueskyClient: BlueskyClient;
	customBlueskyClientBase: string;
	developerMode: boolean;
	recordExplorer: RecordExplorer;
	hideModeratedMessages: boolean;
	inboxPresentation: InboxPresentation;
	gifLoopLimit: number | undefined;
	soundVolumes: SoundVolumes;
	controls: {
		swipeLeftAction: ControlsPreferences["swipeLeftAction"];
		doubleTapEnabled: boolean;
		doubleTapAction: ControlsPreferences["doubleTapAction"];
		doubleTapReactionEmoji: string;
	};
	voiceView: {
		confirmJoin: boolean;
		showNonVideoParticipants: boolean;
		showOwnCamera: boolean;
	};
	experiments: string[];
	dismissedLegacyCommunities: Did[];
};

const oneOf = <T extends string>(
	allowed: readonly T[],
	value: string | undefined,
	fallback: T,
): T =>
	(allowed as readonly string[]).includes(value ?? "")
		? (value as T)
		: fallback;

const volumeOf = (value: unknown, fallback: number): number => {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(100, Math.max(0, Math.round(value)))
		: fallback;
};

const soundVolumesOf = (client: ClientPreferences): SoundVolumes => {
	const saved = client.soundVolumes ?? {};

	const legacy = (group: Exclude<SoundGroup, "ping">) => {
		return volumeOf(client.soundVolume, DEFAULT_SOUND_VOLUMES[group]);
	};

	return {
		ping: volumeOf(saved.ping, DEFAULT_SOUND_VOLUMES.ping),
		presence: volumeOf(saved.presence, legacy("presence")),
		mic: volumeOf(saved.mic, legacy("mic")),
		video: volumeOf(saved.video, legacy("video")),
	};
};

export const resolveClient = (
	client: ClientPreferences,
	defaults: ControlsPreferences,
): ResolvedClient => ({
	theme: oneOf(THEMES, client.theme, "system"),
	messagePreviews: client.messagePreviews ?? defaults.showMessagePreviews,
	linkEmbedsByDefault: client.linkEmbedsByDefault ?? true,
	warnOnExternalLinks: client.warnOnExternalLinks ?? true,
	blueskyClient: oneOf(BLUESKY_CLIENTS, client.blueskyClient, "bluesky"),
	customBlueskyClientBase: client.customBlueskyClientBase ?? "",
	developerMode: client.developerMode ?? defaults.developerMode,
	recordExplorer: oneOf(RECORD_EXPLORERS, client.recordExplorer, "pdsls"),
	hideModeratedMessages: client.hideModeratedMessages ?? false,
	inboxPresentation: oneOf(
		INBOX_PRESENTATIONS,
		client.inboxPresentation,
		"popover",
	),
	gifLoopLimit: (GIF_LOOP_LIMITS as readonly number[]).includes(
		client.gifLoopLimit ?? 0,
	)
		? client.gifLoopLimit
		: undefined,
	soundVolumes: soundVolumesOf(client),
	controls: {
		swipeLeftAction: oneOf(
			["members", "reply"],
			client.controls?.swipeLeftAction,
			defaults.swipeLeftAction,
		),
		doubleTapEnabled:
			client.controls?.doubleTapEnabled ?? defaults.doubleTapEnabled,
		doubleTapAction: oneOf(
			["react", "editOrReply"],
			client.controls?.doubleTapAction,
			defaults.doubleTapAction,
		),
		doubleTapReactionEmoji:
			client.controls?.doubleTapReactionEmoji ??
			defaults.doubleTapReactionEmoji,
	},
	voiceView: {
		confirmJoin: client.voiceView?.confirmJoin ?? defaults.confirmVoiceJoin,
		showNonVideoParticipants:
			client.voiceView?.showNonVideoParticipants ?? true,
		showOwnCamera: client.voiceView?.showOwnCamera ?? true,
	},
	experiments: [...(client.experiments ?? [])],
	dismissedLegacyCommunities: [...(client.dismissedLegacyCommunities ?? [])],
});

export const controlsOf = (client: ResolvedClient): ControlsPreferences => ({
	showMessagePreviews: client.messagePreviews,
	swipeLeftAction: client.controls.swipeLeftAction,
	doubleTapEnabled: client.controls.doubleTapEnabled,
	doubleTapAction: client.controls.doubleTapAction,
	doubleTapReactionEmoji: client.controls.doubleTapReactionEmoji,
	developerMode: client.developerMode,
	confirmVoiceJoin: client.voiceView.confirmJoin,
});

export const clientChangeOf = (
	next: Partial<ControlsPreferences>,
): ClientPreferences => {
	const controls: NonNullable<ClientPreferences["controls"]> = {};
	if (next.swipeLeftAction !== undefined)
		controls.swipeLeftAction = next.swipeLeftAction;
	if (next.doubleTapEnabled !== undefined)
		controls.doubleTapEnabled = next.doubleTapEnabled;
	if (next.doubleTapAction !== undefined)
		controls.doubleTapAction = next.doubleTapAction;
	if (next.doubleTapReactionEmoji !== undefined)
		controls.doubleTapReactionEmoji = next.doubleTapReactionEmoji;
	return {
		...(next.showMessagePreviews !== undefined
			? { messagePreviews: next.showMessagePreviews }
			: {}),
		...(next.developerMode !== undefined
			? { developerMode: next.developerMode }
			: {}),
		...(next.confirmVoiceJoin !== undefined
			? { voiceView: { confirmJoin: next.confirmVoiceJoin } }
			: {}),
		...(Object.keys(controls).length > 0 ? { controls } : {}),
	};
};

export const mergeClient = (
	current: ClientPreferences,
	change: ClientPreferences,
): ClientPreferences => ({
	...current,
	...change,
	...(change.controls
		? { controls: { ...current.controls, ...change.controls } }
		: {}),
	...(change.voiceView
		? { voiceView: { ...current.voiceView, ...change.voiceView } }
		: {}),
	...(change.soundVolumes
		? { soundVolumes: { ...current.soundVolumes, ...change.soundVolumes } }
		: {}),
});
