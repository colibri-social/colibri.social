import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import { BlueskyClientID } from "../atproto/bluesky-alternatives";

const STORAGE_KEY = "colibri:user-preferences";

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
};

const DEFAULT_PREFERENCES: UserPreferencesContextData = {
	membersListVisible: true,
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
	preferredAppView: "https://api.colibri.social",
};

function loadFromStorage(): UserPreferencesContextData {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_PREFERENCES;
		return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
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
