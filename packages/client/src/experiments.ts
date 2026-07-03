import type { Accessor } from "solid-js";
import { useUserPreferences } from "./contexts/UserPreferences";

export type ExperimentDefinition = {
	id: `${string}-v${number}`;
	name: string;
	description: string;
	default?: boolean;
};

export const EXPERIMENTS: ExperimentDefinition[] = [];

export const useExperiment = (id: string): Accessor<boolean> => {
	const { preferences } = useUserPreferences();
	const def = EXPERIMENTS.find((e) => e.id === id);
	return () => preferences().experiments[id] ?? def?.default ?? false;
};
