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
	gain: "auto" | number;
	noiseSurpression: boolean;
	echoCancellation: boolean;
}

export type UserPreferencesContextData = {
	membersListVisible: boolean;
	voice: {
		input: VoiceInputSettings;
		output: VoiceIOSettings;
		camera: BaseVoiceVideoSettings;
	};
};

export type UserPreferencesContextUtility = {};

export const UserPreferencesContext =
	createContext<
		[UserPreferencesContextData, SetStoreFunction<UserPreferencesContextData>]
	>();

export const UserPreferencesContextProvider: ParentComponent = (props) => {
	const [userPreferences, setUserPreferences] = makePersisted(
		createStore<UserPreferencesContextData>({
			membersListVisible: false,
			voice: {
				input: {
					gain: "auto",
					enabled: true,
					volume: 1,
					preferredDeviceId: undefined,
					noiseSurpression: true,
					echoCancellation: true,
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

export const usePreferencesContext = () => {
	const ctx = useContext(UserPreferencesContext);

	if (!ctx) throw new Error("Unable to get user preferences context!");

	return ctx;
};
