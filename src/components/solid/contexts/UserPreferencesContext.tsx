import { makePersisted } from "@solid-primitives/storage";
import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";

interface BaseVoiceVideoSettings {
	enabled: boolean;
	preferredDeviceId: string | undefined;
}

interface VoiceIOSettings extends BaseVoiceVideoSettings {
	volume: number;
}

interface VoiceInputSettings extends VoiceIOSettings {
	noiseSuppression: boolean;
}

interface VolumeOverrides {
	voice: {
		volume: number;
		muted: boolean;
	};
	screen: {
		volume: number;
		muted: boolean;
	};
}

type UserPreferencesContextData = {
	membersListVisible: boolean;
	voice: {
		input: VoiceInputSettings;
		output: VoiceIOSettings;
		camera: BaseVoiceVideoSettings;
		participantVolumeOverrides: Record<string, VolumeOverrides>;
	};
};

type UserPreferencesContextUtility = {};

const UserPreferencesContext =
	createContext<
		[UserPreferencesContextData, SetStoreFunction<UserPreferencesContextData>]
	>();

const UserPreferencesContextProvider: ParentComponent = (props) => {
	const [userPreferences, setUserPreferences] = makePersisted(
		createStore<UserPreferencesContextData>({
			membersListVisible: false,
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
		}),
	);

	const context: [
		UserPreferencesContextData,
		SetStoreFunction<UserPreferencesContextData>,
	] = [userPreferences, setUserPreferences];

	return (
		<UserPreferencesContext.Provider value={context}>
			{props.children}
		</UserPreferencesContext.Provider>
	);
};

const usePreferencesContext = () => {
	const ctx = useContext(UserPreferencesContext);

	if (!ctx) throw new Error("Unable to get user preferences context!");

	return ctx;
};
