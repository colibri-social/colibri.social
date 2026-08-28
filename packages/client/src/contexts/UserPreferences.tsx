import {
	type Accessor,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import {
	type BlueskyClientID,
	isKnownBlueskyClientID,
	normalizeBskyClientBase,
} from "../atproto/bluesky-alternatives";
import { setCustomBskyHost } from "../atproto/bsky-post-url";
import type { GifView } from "../atproto/views";
import { newestVisibleReleaseNoteVersion } from "../release-notes";
import { DEFAULT_APPVIEW_URL, resolveStoredAppViewUrl } from "../utils/appview";
import {
	type EmojiUsage,
	normalizeEmojiUsage,
	pruneEmojiUsage,
} from "../utils/emoji-usage";
import { setExternalLinkWarningEnabled } from "../utils/external-link-warning";
import { isMobileNow } from "../utils/mobile-pane";
import {
	DEFAULT_SCREEN_FRAMERATE,
	DEFAULT_SCREEN_RESOLUTION,
	normalizeFramerate,
	normalizeResolution,
	type ScreenShareOptions,
} from "../utils/screen-share";
import {
	clampSidebarWidth,
	DEFAULT_CHANNEL_SIDEBAR_WIDTH,
} from "../utils/sidebar-width";
import type { AppTheme } from "../utils/theme";

export const PREFERENCES_STORAGE_KEY = "colibri:user-preferences";

const MAX_RECENT_GIFS = 24;

const MAX_TRACKED_EMOJI = 50;

export type VoicePreferences = {
	inputDeviceId: string | null;
	outputDeviceId: string | null;
	inputVolume: number;
	outputVolume: number;
};

interface BaseVoiceVideoSettings {
	enabled: boolean;
	preferredDeviceId: string | undefined;
}

export interface VoiceIOSettings extends BaseVoiceVideoSettings {
	volume: number;
}

export interface VoiceInputSettings extends VoiceIOSettings {
	noiseSuppression: boolean;
	voiceGate: boolean;
}

export interface VolumeOverrides {
	voice: {
		volume: number;
		muted: boolean;
	};
	screen: {
		volume: number;
		muted: boolean;
	};
}

export type SwipeLeftAction = "members" | "reply";
export type DoubleTapAction = "react" | "editOrReply";

export interface ControlsPreferences {
	swipeLeftAction: SwipeLeftAction;
	doubleTapEnabled: boolean;
	doubleTapAction: DoubleTapAction;
	doubleTapReactionEmoji: string;
}

export type UserPreferencesContextData = {
	membersListVisible: boolean;
	channelSidebarWidth: number;
	nativeNotifications: boolean;
	notificationPromptDismissed: boolean;
	activityPromptDismissed: boolean;
	notificationDefaultApplied: boolean;
	lastSeenReleaseNote: string | null;
	voice: {
		input: VoiceInputSettings;
		output: VoiceIOSettings;
		camera: BaseVoiceVideoSettings;
		screen: ScreenShareOptions;
		participantVolumeOverrides: Record<string, VolumeOverrides>;
		selfMuted: boolean;
		selfDeafened: boolean;
		showNonVideoParticipants: boolean;
		showOwnCamera: boolean;
	};
	preferredBlueskyClient: BlueskyClientID;
	customBlueskyClientBase: string;
	preferredAppView: string;
	sharePresence: boolean;
	hideCrossAppViewHint: boolean;
	attachAccountToReports: boolean;
	linkEmbedsByDefault: boolean;
	warnOnExternalLinks: boolean;
	nativeWindowDecorations: boolean;
	theme: AppTheme | null;
	recentGifs: Array<GifView>;
	emojiUsage: Record<string, EmojiUsage>;
	experiments: Record<string, boolean>;
	controls: ControlsPreferences;
};

const DEFAULT_PREFERENCES: UserPreferencesContextData = {
	membersListVisible: !isMobileNow(),
	channelSidebarWidth: DEFAULT_CHANNEL_SIDEBAR_WIDTH,
	nativeNotifications: false,
	notificationPromptDismissed: false,
	activityPromptDismissed: false,
	notificationDefaultApplied: false,
	lastSeenReleaseNote: null,
	voice: {
		input: {
			enabled: true,
			volume: 1,
			preferredDeviceId: undefined,
			noiseSuppression: true,
			voiceGate: false,
		},
		output: {
			enabled: true,
			volume: 1,
			preferredDeviceId: undefined,
		},
		camera: {
			enabled: false,
			preferredDeviceId: undefined,
		},
		screen: {
			resolution: DEFAULT_SCREEN_RESOLUTION,
			framerate: DEFAULT_SCREEN_FRAMERATE,
			shareAudio: true,
		},
		participantVolumeOverrides: {},
		selfMuted: false,
		selfDeafened: false,
		showNonVideoParticipants: true,
		showOwnCamera: true,
	},
	preferredBlueskyClient: "bluesky",
	customBlueskyClientBase: "",
	preferredAppView: DEFAULT_APPVIEW_URL,
	sharePresence: true,
	hideCrossAppViewHint: false,
	attachAccountToReports: false,
	linkEmbedsByDefault: true,
	warnOnExternalLinks: true,
	nativeWindowDecorations: false,
	theme: null,
	recentGifs: [],
	emojiUsage: {},
	experiments: {},
	controls: {
		swipeLeftAction: "members",
		doubleTapEnabled: false,
		doubleTapAction: "react",
		doubleTapReactionEmoji: "👍",
	},
};

const GATED_LEGACY_MODE = "high";

function resolveNoiseSuppression(parsedInput: Record<string, unknown>): {
	noiseSuppression: boolean;
	voiceGate: boolean;
} {
	const stored = parsedInput.noiseSuppressionMode;

	if (typeof stored === "string") {
		return {
			noiseSuppression: stored !== "off",
			voiceGate: stored === GATED_LEGACY_MODE,
		};
	}

	if (typeof parsedInput.noiseSuppression === "boolean") {
		return {
			noiseSuppression: parsedInput.noiseSuppression,
			voiceGate: parsedInput.voiceGate === true,
		};
	}

	const defaults = DEFAULT_PREFERENCES.voice.input;
	return {
		noiseSuppression: defaults.noiseSuppression,
		voiceGate: defaults.voiceGate,
	};
}

function resolveStoredBlueskyClient(parsed: {
	preferredBlueskyClient?: unknown;
	customBlueskyClientBase?: unknown;
}): Pick<
	UserPreferencesContextData,
	"preferredBlueskyClient" | "customBlueskyClientBase"
> {
	const base =
		typeof parsed.customBlueskyClientBase === "string"
			? (normalizeBskyClientBase(parsed.customBlueskyClientBase) ?? "")
			: "";

	if (!isKnownBlueskyClientID(parsed.preferredBlueskyClient)) {
		return {
			preferredBlueskyClient: DEFAULT_PREFERENCES.preferredBlueskyClient,
			customBlueskyClientBase: base,
		};
	}

	return {
		preferredBlueskyClient: parsed.preferredBlueskyClient,
		customBlueskyClientBase: base,
	};
}

function loadFromStorage(): UserPreferencesContextData {
	try {
		const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
		if (!raw) {
			return {
				...DEFAULT_PREFERENCES,
				lastSeenReleaseNote: newestVisibleReleaseNoteVersion(),
			};
		}
		const parsed = JSON.parse(raw);
		const parsedVoice = parsed.voice ?? {};
		const parsedInput = parsedVoice.input ?? {};
		const defaultInput = DEFAULT_PREFERENCES.voice.input;

		const input: VoiceInputSettings = {
			enabled: parsedInput.enabled ?? defaultInput.enabled,
			volume: parsedInput.volume ?? defaultInput.volume,
			preferredDeviceId:
				parsedInput.preferredDeviceId ?? defaultInput.preferredDeviceId,
			...resolveNoiseSuppression(parsedInput),
		};

		const parsedScreen = parsedVoice.screen ?? {};
		const screen: ScreenShareOptions = {
			resolution: normalizeResolution(parsedScreen.resolution),
			framerate: normalizeFramerate(parsedScreen.framerate),
			shareAudio:
				typeof parsedScreen.shareAudio === "boolean"
					? parsedScreen.shareAudio
					: DEFAULT_PREFERENCES.voice.screen.shareAudio,
		};

		return {
			...DEFAULT_PREFERENCES,
			...parsed,
			membersListVisible: DEFAULT_PREFERENCES.membersListVisible,
			channelSidebarWidth: clampSidebarWidth(parsed.channelSidebarWidth),
			voice: { ...DEFAULT_PREFERENCES.voice, ...parsedVoice, input, screen },
			emojiUsage: normalizeEmojiUsage(parsed.emojiUsage),
			preferredAppView: resolveStoredAppViewUrl(parsed.preferredAppView),
			...resolveStoredBlueskyClient(parsed),
			controls: { ...DEFAULT_PREFERENCES.controls, ...(parsed.controls ?? {}) },
		};
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

type UserPreferencesContextValue = {
	preferences: Accessor<UserPreferencesContextData>;
	setPreferences: Setter<UserPreferencesContextData>;
	emojiUsage: Accessor<Record<string, EmojiUsage>>;
	updateVoice: (patch: Partial<VoicePreferences>) => void;
	setVoiceSelfState: (patch: {
		selfMuted?: boolean;
		selfDeafened?: boolean;
	}) => void;
	setParticipantVolume: (did: string, volume: number) => void;
	setParticipantScreenVolume: (did: string, volume: number) => void;
	setScreenShare: (patch: Partial<ScreenShareOptions>) => void;
	setNoiseSuppression: (enabled: boolean) => void;
	setVoiceGate: (enabled: boolean) => void;
	setVoiceView: (patch: {
		showNonVideoParticipants?: boolean;
		showOwnCamera?: boolean;
	}) => void;
	toggleMembersVisible: () => void;
	setChannelSidebarWidth: (width: number) => void;
	setNativeNotifications: (enabled: boolean) => void;
	setNotificationPromptDismissed: (dismissed: boolean) => void;
	setActivityPromptDismissed: (dismissed: boolean) => void;
	setNotificationDefaultApplied: (applied: boolean) => void;
	setLastSeenReleaseNote: (version: string | null) => void;
	setPreferredBlueskyClient: (
		client: BlueskyClientID,
		customBase?: string,
	) => void;
	setPreferredAppView: (appView: string) => void;
	setSharePresence: (enabled: boolean) => void;
	setHideCrossAppViewHint: (hidden: boolean) => void;
	setAttachAccountToReports: (enabled: boolean) => void;
	setLinkEmbedsByDefault: (enabled: boolean) => void;
	setWarnOnExternalLinks: (enabled: boolean) => void;
	setNativeWindowDecorations: (enabled: boolean) => void;
	setTheme: (theme: AppTheme | null) => void;
	pushRecentGif: (gif: GifView) => void;
	recordEmojiUse: (emoji: string) => void;
	setExperiment: (id: string, enabled: boolean) => void;
	updateControls: (patch: Partial<ControlsPreferences>) => void;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue>();

export const UserPreferencesContextProvider: ParentComponent = (props) => {
	const [preferences, setPreferences] =
		createSignal<UserPreferencesContextData>(loadFromStorage());

	// Persist to localStorage whenever preferences change.
	createEffect(() => {
		try {
			localStorage.setItem(
				PREFERENCES_STORAGE_KEY,
				JSON.stringify(preferences()),
			);
		} catch {
			// localStorage not available (private browsing, etc.)
		}
	});

	createEffect(() => {
		setExternalLinkWarningEnabled(preferences().warnOnExternalLinks);
	});

	createEffect(() => {
		const { preferredBlueskyClient, customBlueskyClientBase } = preferences();
		setCustomBskyHost(
			preferredBlueskyClient === "custom"
				? normalizeBskyClientBase(customBlueskyClientBase)
				: null,
		);
	});

	const updateVoice = (patch: Partial<VoicePreferences>) => {
		setPreferences((p) => ({ ...p, voice: { ...p.voice, ...patch } }));
	};

	const setVoiceSelfState = (patch: {
		selfMuted?: boolean;
		selfDeafened?: boolean;
	}) => {
		setPreferences((p) => ({ ...p, voice: { ...p.voice, ...patch } }));
	};

	const setParticipantChannelVolume = (
		did: string,
		channel: keyof VolumeOverrides,
		volume: number,
	) => {
		setPreferences((p) => {
			const existing = p.voice.participantVolumeOverrides[did] ?? {
				voice: { volume: 1, muted: false },
				screen: { volume: 1, muted: false },
			};

			return {
				...p,
				voice: {
					...p.voice,
					participantVolumeOverrides: {
						...p.voice.participantVolumeOverrides,
						[did]: {
							...existing,
							[channel]: { ...existing[channel], volume },
						},
					},
				},
			};
		});
	};

	const setParticipantVolume = (did: string, volume: number) => {
		setParticipantChannelVolume(did, "voice", volume);
	};

	const setParticipantScreenVolume = (did: string, volume: number) => {
		setParticipantChannelVolume(did, "screen", volume);
	};

	const setScreenShare = (patch: Partial<ScreenShareOptions>) => {
		setPreferences((p) => ({
			...p,
			voice: { ...p.voice, screen: { ...p.voice.screen, ...patch } },
		}));
	};

	const setNoiseSuppression = (enabled: boolean) => {
		setPreferences((p) => ({
			...p,
			voice: {
				...p.voice,
				input: { ...p.voice.input, noiseSuppression: enabled },
			},
		}));
	};

	const setVoiceGate = (enabled: boolean) => {
		setPreferences((p) => ({
			...p,
			voice: { ...p.voice, input: { ...p.voice.input, voiceGate: enabled } },
		}));
	};

	const setVoiceView = (patch: {
		showNonVideoParticipants?: boolean;
		showOwnCamera?: boolean;
	}) => {
		setPreferences((p) => ({ ...p, voice: { ...p.voice, ...patch } }));
	};

	const toggleMembersVisible = () => {
		setPreferences((p) => ({
			...p,
			membersListVisible: !p.membersListVisible,
		}));
	};

	const setChannelSidebarWidth = (width: number) => {
		setPreferences((p) => ({
			...p,
			channelSidebarWidth: clampSidebarWidth(width),
		}));
	};

	const setNativeNotifications = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, nativeNotifications: enabled }));
	};

	const setNotificationPromptDismissed = (dismissed: boolean) => {
		setPreferences((p) => ({ ...p, notificationPromptDismissed: dismissed }));
	};

	const setActivityPromptDismissed = (dismissed: boolean) => {
		setPreferences((p) => ({ ...p, activityPromptDismissed: dismissed }));
	};

	const setNotificationDefaultApplied = (applied: boolean) => {
		setPreferences((p) => ({ ...p, notificationDefaultApplied: applied }));
	};

	const setLastSeenReleaseNote = (version: string | null) => {
		setPreferences((p) => ({ ...p, lastSeenReleaseNote: version }));
	};

	const setPreferredBlueskyClient = (
		client: BlueskyClientID,
		customBase?: string,
	) => {
		setPreferences((p) => ({
			...p,
			preferredBlueskyClient: client,
			customBlueskyClientBase:
				customBase === undefined
					? p.customBlueskyClientBase
					: (normalizeBskyClientBase(customBase) ?? ""),
		}));
	};

	const setPreferredAppView = (appView: string) => {
		setPreferences((p) => ({ ...p, preferredAppView: appView }));
	};

	const setSharePresence = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, sharePresence: enabled }));
	};

	const setHideCrossAppViewHint = (hidden: boolean) => {
		setPreferences((p) => ({ ...p, hideCrossAppViewHint: hidden }));
	};

	const setAttachAccountToReports = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, attachAccountToReports: enabled }));
	};

	const setLinkEmbedsByDefault = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, linkEmbedsByDefault: enabled }));
	};

	const setWarnOnExternalLinks = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, warnOnExternalLinks: enabled }));
	};

	const setNativeWindowDecorations = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, nativeWindowDecorations: enabled }));
	};

	const setTheme = (theme: AppTheme | null) => {
		setPreferences((p) => ({ ...p, theme }));
	};

	const pushRecentGif = (gif: GifView) => {
		setPreferences((p) => ({
			...p,
			recentGifs: [gif, ...p.recentGifs.filter((g) => g.id !== gif.id)].slice(
				0,
				MAX_RECENT_GIFS,
			),
		}));
	};

	const emojiUsage = createMemo(() => preferences().emojiUsage);

	const recordEmojiUse = (emoji: string) => {
		setPreferences((p) => {
			const previous = p.emojiUsage[emoji];
			return {
				...p,
				emojiUsage: pruneEmojiUsage(
					{
						...p.emojiUsage,
						[emoji]: {
							count: (previous?.count ?? 0) + 1,
							lastUsed: Date.now(),
						},
					},
					MAX_TRACKED_EMOJI,
				),
			};
		});
	};

	const setExperiment = (id: string, enabled: boolean) => {
		setPreferences((p) => ({
			...p,
			experiments: { ...p.experiments, [id]: enabled },
		}));
	};

	const updateControls = (patch: Partial<ControlsPreferences>) => {
		setPreferences((p) => ({ ...p, controls: { ...p.controls, ...patch } }));
	};

	return (
		<UserPreferencesContext.Provider
			value={{
				preferences,
				setPreferences,
				emojiUsage,
				updateVoice,
				setVoiceSelfState,
				setParticipantVolume,
				setParticipantScreenVolume,
				setScreenShare,
				setNoiseSuppression,
				setVoiceGate,
				setVoiceView,
				toggleMembersVisible,
				setChannelSidebarWidth,
				setNativeNotifications,
				setNotificationPromptDismissed,
				setActivityPromptDismissed,
				setNotificationDefaultApplied,
				setLastSeenReleaseNote,
				setPreferredBlueskyClient,
				setPreferredAppView,
				setSharePresence,
				setHideCrossAppViewHint,
				setAttachAccountToReports,
				setLinkEmbedsByDefault,
				setWarnOnExternalLinks,
				setNativeWindowDecorations,
				setTheme,
				pushRecentGif,
				recordEmojiUse,
				setExperiment,
				updateControls,
			}}
		>
			{props.children}
		</UserPreferencesContext.Provider>
	);
};

export const useUserPreferences = (): UserPreferencesContextValue => {
	const ctx = useContext(UserPreferencesContext);
	if (!ctx)
		throw new Error(
			"useUserPreferences called outside UserPreferencesContextProvider",
		);
	return ctx;
};
