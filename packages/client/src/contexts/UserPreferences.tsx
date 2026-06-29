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

export interface VoiceInputSettings extends VoiceIOSettings {
	noiseSuppression: boolean;
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
	/** Whether native OS notifications are enabled (opt-in, requires permission). */
	nativeNotifications: boolean;
	voice: {
		input: VoiceInputSettings;
		output: VoiceIOSettings;
		camera: BaseVoiceVideoSettings;
		participantVolumeOverrides: Record<string, VolumeOverrides>;
	};
	preferredBlueskyClient: BlueskyClientID;
	preferredAppView: string;
	/** Most-recently-used GIFs (newest first), shown in the picker's Recents. */
	recentGifs: Array<GifItem>;
};

const DEFAULT_PREFERENCES: UserPreferencesContextData = {
	membersListVisible: false,
	nativeNotifications: false,
	voice: {
		input: {
			enabled: true,
			volume: 1,
			preferredDeviceId: undefined,
			noiseSuppression: true,
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
	},
	preferredBlueskyClient: "bluesky",
	preferredAppView: DEFAULT_APPVIEW_URL,
	recentGifs: [],
};

function loadFromStorage(): UserPreferencesContextData {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_PREFERENCES;
		return {
			...DEFAULT_PREFERENCES,
			...JSON.parse(raw),
			membersListVisible: DEFAULT_PREFERENCES.membersListVisible,
		};
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

type UserPreferencesContextValue = {
	preferences: Accessor<UserPreferencesContextData>;
	setPreferences: Setter<UserPreferencesContextData>;
	updateVoice: (patch: Partial<VoicePreferences>) => void;
	toggleMembersVisible: () => void;
	setNativeNotifications: (enabled: boolean) => void;
	setPreferredBlueskyClient: (client: BlueskyClientID) => void;
	setPreferredAppView: (appView: string) => void;
	pushRecentGif: (gif: GifItem) => void;
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

	const toggleMembersVisible = () => {
		setPreferences((p) => ({
			...p,
			membersListVisible: !p.membersListVisible,
		}));
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

	const pushRecentGif = (gif: GifItem) => {
		setPreferences((p) => ({
			...p,
			recentGifs: [
				gif,
				...p.recentGifs.filter((g) => g.id !== gif.id),
			].slice(0, MAX_RECENT_GIFS),
		}));
	};

	return (
		<UserPreferencesContext.Provider
			value={{
				preferences,
				setPreferences,
				updateVoice,
				toggleMembersVisible,
				setNativeNotifications,
				setPreferredBlueskyClient,
				setPreferredAppView,
				pushRecentGif,
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
