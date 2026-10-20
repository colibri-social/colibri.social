import type { ControlsPreferences } from "../source";
import {
	BLUESKY_CLIENTS,
	type BlueskyClient,
	type ClientPreferences,
	GIF_LOOP_LIMITS,
	INBOX_PRESENTATIONS,
	type InboxPresentation,
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
	hideModeratedMessages: boolean;
	inboxPresentation: InboxPresentation;
	gifLoopLimit: number | undefined;
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
};

const oneOf = <T extends string>(
	allowed: readonly T[],
	value: string | undefined,
	fallback: T,
): T =>
	(allowed as readonly string[]).includes(value ?? "")
		? (value as T)
		: fallback;

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
});
