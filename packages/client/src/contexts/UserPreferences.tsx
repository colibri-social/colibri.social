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
import { DEFAULT_APPVIEW_URL } from "../utils/appview";
import { isMobileNow } from "../utils/mobile-pane";

const STORAGE_KEY = "colibri:user-preferences";

/** How many recently-used GIFs to keep in the picker's Recents row. */
const MAX_RECENT_GIFS = 24;

export type VoicePreferences = {
	inputDeviceId: string | null;
	outputDeviceId: string | null;
	noiseSuppressionEnabled: boolean;
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

export type NoiseSuppressionMode = "off" | "rnnoise" | "deepfilternet";

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

export type UserPreferencesContextData = {
	membersListVisible: boolean;
	/** Whether the "messages are public" reminder banner has been dismissed. */
	publicReminderDismissed: boolean;
	/** Whether native OS notifications are enabled (opt-in, requires permission). */
	nativeNotifications: boolean;
	voice: {
		input: VoiceInputSettings;
		output: VoiceIOSettings;
		camera: BaseVoiceVideoSettings;
		participantVolumeOverrides: Record<string, VolumeOverrides>;
		selfMuted: boolean;
		selfDeafened: boolean;
		showNonVideoParticipants: boolean;
		showOwnCamera: boolean;
	};
	preferredBlueskyClient: BlueskyClientID;
	preferredAppView: string;
	sharePresence: boolean;
	/** Most-recently-used GIFs (newest first), shown in the picker's Recents. */
	recentGifs: Array<GifItem>;
	/** Per-experiment opt-in state, keyed by experiment id. */
	experiments: Record<string, boolean>;
};

const DEFAULT_PREFERENCES: UserPreferencesContextData = {
	membersListVisible: !isMobileNow(),
	publicReminderDismissed: false,
	nativeNotifications: false,
	voice: {
		input: {
			enabled: true,
			volume: 1,
			preferredDeviceId: undefined,
			noiseSuppressionMode: "deepfilternet",
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
		participantVolumeOverrides: {},
		selfMuted: false,
		selfDeafened: false,
		showNonVideoParticipants: true,
		showOwnCamera: true,
	},
	preferredBlueskyClient: "bluesky",
	preferredAppView: DEFAULT_APPVIEW_URL,
	sharePresence: true,
	recentGifs: [],
	experiments: {},
};

function loadFromStorage(): UserPreferencesContextData {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_PREFERENCES;
		const parsed = JSON.parse(raw);
		const parsedVoice = parsed.voice ?? {};
		const parsedInput = parsedVoice.input ?? {};
		const defaultInput = DEFAULT_PREFERENCES.voice.input;

		const input: VoiceInputSettings = {
			enabled: parsedInput.enabled ?? defaultInput.enabled,
			volume: parsedInput.volume ?? defaultInput.volume,
			preferredDeviceId:
				parsedInput.preferredDeviceId ?? defaultInput.preferredDeviceId,
			noiseSuppressionMode:
				parsedInput.noiseSuppressionMode ??
				(typeof parsedInput.noiseSuppression === "boolean"
					? parsedInput.noiseSuppression
						? "deepfilternet"
						: "off"
					: defaultInput.noiseSuppressionMode),
			noiseSuppressionLevel:
				typeof parsedInput.noiseSuppressionLevel === "number"
					? parsedInput.noiseSuppressionLevel
					: defaultInput.noiseSuppressionLevel,
		};

		return {
			...DEFAULT_PREFERENCES,
			...parsed,
			membersListVisible: DEFAULT_PREFERENCES.membersListVisible,
			voice: { ...DEFAULT_PREFERENCES.voice, ...parsedVoice, input },
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
	setNoiseSuppressionMode: (mode: NoiseSuppressionMode) => void;
	setNoiseSuppressionLevel: (level: number) => void;
	setVoiceView: (patch: {
		showNonVideoParticipants?: boolean;
		showOwnCamera?: boolean;
	}) => void;
	toggleMembersVisible: () => void;
	setPublicReminderDismissed: (dismissed: boolean) => void;
	setNativeNotifications: (enabled: boolean) => void;
	setPreferredBlueskyClient: (client: BlueskyClientID) => void;
	setPreferredAppView: (appView: string) => void;
	setSharePresence: (enabled: boolean) => void;
	pushRecentGif: (gif: GifItem) => void;
	setExperiment: (id: string, enabled: boolean) => void;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue>();

export const UserPreferencesContextProvider: ParentComponent = (props) => {
	const [preferences, setPreferences] =
		createSignal<UserPreferencesContextData>(loadFromStorage());

	// Persist to localStorage whenever preferences change.
	createEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences()));
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

	const setParticipantVolume = (did: string, volume: number) => {
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
						[did]: { ...existing, voice: { ...existing.voice, volume } },
					},
				},
			};
		});
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

	const setPreferredBlueskyClient = (client: BlueskyClientID) => {
		setPreferences((p) => ({ ...p, preferredBlueskyClient: client }));
	};

	const setPreferredAppView = (appView: string) => {
		setPreferences((p) => ({ ...p, preferredAppView: appView }));
	};

	const setSharePresence = (enabled: boolean) => {
		setPreferences((p) => ({ ...p, sharePresence: enabled }));
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

	return (
		<UserPreferencesContext.Provider
			value={{
				preferences,
				setPreferences,
				updateVoice,
				setVoiceSelfState,
				setParticipantVolume,
				setNoiseSuppressionMode,
				setNoiseSuppressionLevel,
				setVoiceView,
				toggleMembersVisible,
				setPublicReminderDismissed,
				setNativeNotifications,
				setPreferredBlueskyClient,
				setPreferredAppView,
				setSharePresence,
				pushRecentGif,
				setExperiment,
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
