import type { Accessor } from "solid-js";
import { useUserPreferences } from "./contexts/UserPreferences";
import { EXPERIMENTAL_DENOISERS_EXPERIMENT } from "./hooks/noise/modes";

export type ExperimentDefinition = {
	id: `${string}-v${number}`;
	name: string;
	description: string;
	default?: boolean;
};

export const EXPERIMENTS: ExperimentDefinition[] = [
	{
		id: EXPERIMENTAL_DENOISERS_EXPERIMENT,
		name: "Noise suppression",
		description:
			"Adds DTLN, GTCRN and UL-UNAS to the noise suppression options in voice settings. They download extra models on first use.",
	},
	{
		id: "light-mode-v1",
		name: "Light mode",
		description:
			"Adds an appearance setting to the Preferences so you can switch the app to a light theme. It follows your system by default and is still rough in places.",
	},
];

export const useExperiment = (id: string): Accessor<boolean> => {
	const { preferences } = useUserPreferences();
	const def = EXPERIMENTS.find((e) => e.id === id);
	return () => preferences().experiments[id] ?? def?.default ?? false;
};
