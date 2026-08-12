import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import type { BlueskyClientID } from "../atproto/bluesky-alternatives";
import type { GifItem } from "../atproto/xrpc/social/colibri/embed/gifTypes";
import {
	EXPERIMENTAL_DENOISERS_EXPERIMENT,
	isNoiseSuppressionMode,
	noiseMode,
} from "../hooks/noise/modes";
import { newestReleaseNoteVersion } from "../release-notes";
import { DEFAULT_APPVIEW_URL } from "../utils/appview";
import { isMobileNow } from "../utils/mobile-pane";
import {
	DEFAULT_SCREEN_FRAMERATE,
	DEFAULT_SCREEN_RESOLUTION,
	normalizeFramerate,
	normalizeResolution,
	type ScreenShareOptions,
} from "../utils/screen-share";
import type { AppTheme } from "../utils/theme";

export const PREFERENCES_STORAGE_KEY = "colibri:user-preferences";

const MAX_RECENT_GIFS = 24;

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

export type NoiseSuppressionMode =
	| "off"
	| "low"
	| "medium"
	| "high"
	| "exp-dtln"
	| "exp-gtcrn"
	| "exp-ulunas";

const LEGACY_NOISE_SUPPRESSION_MODES: Record<string, NoiseSuppressionMode> = {
	rnnoise: "low",
	deepfilternet: "medium",
};

export interface VoiceInputSettings extends VoiceIOSettings {
	noiseSuppressionMode: NoiseSuppressionMode;
	noiseSuppressionLevel: number;
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
	publicReminderDismissed: boolean;
	nativeNotifications: boolean;
	notificationPromptDismissed: boolean;
	notificationDefaultApplied: boolean;
	lastSeenReleaseNote: string | null;
	chatGuidelinesAccepted: boolean;
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
		noiseSuppressionHints: boolean;
	};
	preferredBlueskyClient: BlueskyClientID;
	preferredAppView: string;
	sharePresence: boolean;
	attachAccountToReports: boolean;
	nativeWindowDecorations: boolean;
	theme: AppTheme | null;
	recentGifs: Array<GifItem>;
	experiments: Record<string, boolean>;
	controls: ControlsPreferences;
};

const DEFAULT_PREFERENCES: UserPreferencesContextData = {
	membersListVisible: !isMobileNow(),
	publicReminderDismissed: false,
	nativeNotifications: false,
	notificationPromptDismissed: false,
	notificationDefaultApplied: false,
	lastSeenReleaseNote: null,
	chatGuidelinesAccepted: false,
	voice: {
		input: {
			enabled: true,
			volume: 1,
			preferredDeviceId: undefined,
			noiseSuppressionMode: "medium",
			noiseSuppressionLevel: 80,
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
		noiseSuppressionHints: true,
	},
	preferredBlueskyClient: "bluesky",
	preferredAppView: DEFAULT_APPVIEW_URL,
	sharePresence: true,
	attachAccountToReports: false,
	nativeWindowDecorations: false,
	theme: null,
	recentGifs: [],
	experiments: {},
	controls: {
		swipeLeftAction: "members",
		doubleTapEnabled: false,
		doubleTapAction: "react",
		doubleTapReactionEmoji: "👍",
	},
};

function resolveNoiseSuppressionMode(
	parsedInput: Record<string, unknown>,
	experimentsEnabled: boolean,
): NoiseSuppressionMode {
	const fallback = DEFAULT_PREFERENCES.voice.input.noiseSuppressionMode;
	const stored = parsedInput.noiseSuppressionMode;

	let mode: NoiseSuppressionMode;
	if (isNoiseSuppressionMode(stored)) {
		mode = stored;
	} else if (
		typeof stored === "string" &&
		stored in LEGACY_NOISE_SUPPRESSION_MODES
	) {
		mode = LEGACY_NOISE_SUPPRESSION_MODES[stored];
	} else if (
		stored === undefined &&
		typeof parsedInput.noiseSuppression === "boolean"
	) {
		mode = parsedInput.noiseSuppression ? "medium" : "off";
	} else {
		mode = fallback;
	}

	if (noiseMode(mode).experimental && !experimentsEnabled) return fallback;
	return mode;
}

function loadFromStorage(): UserPreferencesContextData {
	try {
		const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
		if (!raw) {
			return {
				...DEFAULT_PREFERENCES,
				lastSeenReleaseNote: newestReleaseNoteVersion(),
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
			noiseSuppressionMode: resolveNoiseSuppressionMode(
				parsedInput,
				parsed.experiments?.[EXPERIMENTAL_DENOISERS_EXPERIMENT] === true,
			),
			noiseSuppressionLevel:
				typeof parsedInput.noiseSuppressionLevel === "number"
					? parsedInput.noiseSuppressionLevel
					: defaultInput.noiseSuppressionLevel,
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
			voice: { ...DEFAULT_PREFERENCES.voice, ...parsedVoice, input, screen },
			controls: { ...DEFAULT_PREFERENCES.controls, ...(parsed.controls ?? {}) },
		};
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

type UserPreferencesContextValue = {
	preferences: Accessor<UserPreferencesContextData>;
	setPreferences: Setter<UserPreferencesContextData>;
	updateVoice: (patch: Partial<VoicePreferences>) => void;
	setVoiceSelfState: (patch: {
		selfMuted?: boolean;
		selfDeafened?: boolean;
	}) => void;
	setParticipantVolume: (did: string, volume: number) => void;
	setParticipantScreenVolume: (did: string, volume: number) => void;
	setScreenShare: (patch: Partial<ScreenShareOptions>) => void;
	setNoiseSuppressionMode: (mode: NoiseSuppressionMode) => void;
	setNoiseSuppressionLevel: (level: number) => void;
	setVoiceView: (patch: {
		showNonVideoParticipants?: boolean;
		showOwnCamera?: boolean;
	}) => void;
	toggleMembersVisible: () => void;
	setPublicReminderDismissed: (dismissed: boolean) => void;
	setNativeNotifications: (enabled: boolean) => void;
	setNotificationPromptDismissed: (dismissed: boolean) => void;
	setNotificationDefaultApplied: (applied: boolean) => void;
	setLastSeenReleaseNote: (version: string | null) => void;
	setChatGuidelinesAccepted: (accepted: boolean) => void;
	setNoiseSuppressionHints: (enabled: boolean) => void;
	setPreferredBlueskyClient: (client: BlueskyClientID) => void;
	setPreferredAppView: (appView: string) => void;
	setSharePresence: (enabled: boolean) => void;
	setAttachAccountToReports: (enabled: boolean) => void;
	setNativeWindowDecorations: (enabled: boolean) => void;
	setTheme: (theme: AppTheme | null) => void;
	pushRecentGif: (gif: GifItem) => void;
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

	const setNoiseSuppressionMode = (mode: NoiseSuppressionMode) => {
		setPreferences((p) => ({
			...p,
			voice: {
				...p.voice,
				input: { ...p.voice.input, noiseSuppressionMode: mode },
			},
		}));
	};

	const setNoiseSuppressionLevel = (level: number) => {
		const clamped = Math.max(0, Math.min(100, Math.round(level)));
		setPreferences((p) => ({
			...p,
			voice: {
				...p.voice,
				input: { ...p.voice.input, noiseSuppressionLevel: clamped },
			},
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

	const setPublicReminderDismissed = (dismissed: boolean) => {
		setPreferences((p) => ({ ...p, publicReminderDismissed: dismissed }));
	};

	const setNativeNotifications = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, nativeNotifications: enabled }));
	};

	const setNotificationPromptDismissed = (dismissed: boolean) => {
		setPreferences((p) => ({ ...p, notificationPromptDismissed: dismissed }));
	};

	const setNotificationDefaultApplied = (applied: boolean) => {
		setPreferences((p) => ({ ...p, notificationDefaultApplied: applied }));
	};

	const setLastSeenReleaseNote = (version: string | null) => {
		setPreferences((p) => ({ ...p, lastSeenReleaseNote: version }));
	};

	const setChatGuidelinesAccepted = (accepted: boolean) => {
		setPreferences((p) => ({ ...p, chatGuidelinesAccepted: accepted }));
	};

	const setNoiseSuppressionHints = (enabled: boolean) => {
		setPreferences((p) => ({
			...p,
			voice: { ...p.voice, noiseSuppressionHints: enabled },
		}));
	};

	const setPreferredBlueskyClient = (client: BlueskyClientID) => {
		setPreferences((p) => ({ ...p, preferredBlueskyClient: client }));
	};

	const setPreferredAppView = (appView: string) => {
		setPreferences((p) => ({ ...p, preferredAppView: appView }));
	};

	const setSharePresence = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, sharePresence: enabled }));
	};

	const setAttachAccountToReports = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, attachAccountToReports: enabled }));
	};

	const setNativeWindowDecorations = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, nativeWindowDecorations: enabled }));
	};

	const setTheme = (theme: AppTheme | null) => {
		setPreferences((p) => ({ ...p, theme }));
	};

	const pushRecentGif = (gif: GifItem) => {
		setPreferences((p) => ({
			...p,
			recentGifs: [gif, ...p.recentGifs.filter((g) => g.id !== gif.id)].slice(
				0,
				MAX_RECENT_GIFS,
			),
		}));
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
				updateVoice,
				setVoiceSelfState,
				setParticipantVolume,
				setParticipantScreenVolume,
				setScreenShare,
				setNoiseSuppressionMode,
				setNoiseSuppressionLevel,
				setVoiceView,
				toggleMembersVisible,
				setPublicReminderDismissed,
				setNativeNotifications,
				setNotificationPromptDismissed,
				setNotificationDefaultApplied,
				setLastSeenReleaseNote,
				setChatGuidelinesAccepted,
				setNoiseSuppressionHints,
				setPreferredBlueskyClient,
				setPreferredAppView,
				setSharePresence,
				setAttachAccountToReports,
				setNativeWindowDecorations,
				setTheme,
				pushRecentGif,
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
