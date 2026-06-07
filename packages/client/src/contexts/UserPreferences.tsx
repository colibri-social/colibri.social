import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";

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
	voice: {
		input: VoiceInputSettings;
		output: VoiceIOSettings;
		camera: BaseVoiceVideoSettings;
		participantVolumeOverrides: Record<string, VolumeOverrides>;
	};
};

const DEFAULT_PREFERENCES: UserPreferencesContextData = {
	membersListVisible: true,
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

	return (
		<UserPreferencesContext.Provider
			value={{ preferences, setPreferences, updateVoice, toggleMembersVisible }}
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
