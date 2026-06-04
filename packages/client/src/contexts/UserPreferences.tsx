import {
	createContext,
	createEffect,
	createSignal,
	type Accessor,
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

export type UserPreferencesData = {
	voice: VoicePreferences;
	membersListVisible: boolean;
};

const DEFAULT_PREFERENCES: UserPreferencesData = {
	voice: {
		inputDeviceId: null,
		outputDeviceId: null,
		noiseSuppressionEnabled: true,
		inputVolume: 100,
		outputVolume: 100,
	},
	membersListVisible: true,
};

function loadFromStorage(): UserPreferencesData {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_PREFERENCES;
		return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
	} catch {
		return DEFAULT_PREFERENCES;
	}
}

type UserPreferencesContextValue = {
	preferences: Accessor<UserPreferencesData>;
	setPreferences: Setter<UserPreferencesData>;
	updateVoice: (patch: Partial<VoicePreferences>) => void;
	toggleMembersVisible: () => void;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue>();

export const UserPreferencesContextProvider: ParentComponent = (props) => {
	const [preferences, setPreferences] =
		createSignal<UserPreferencesData>(loadFromStorage());

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
		setPreferences((p) => ({ ...p, membersListVisible: !p.membersListVisible }));
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
