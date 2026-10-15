import type { Experiment } from "@colibri-social/ui";
import type { PreferenceStore } from "./preferences/store";

export type ExperimentDefinition = {
	id: `${string}-v${number}`;
	name: string;
	description: string;
};

export const EXPERIMENTS: readonly ExperimentDefinition[] = [];

export const experimentViews = (
	enabled: readonly string[],
	definitions: readonly ExperimentDefinition[] = EXPERIMENTS,
): Experiment[] =>
	definitions.map((definition) => ({
		id: definition.id,
		name: definition.name,
		description: definition.description,
		enabled: enabled.includes(definition.id),
	}));

export const isExperimentOn = (
	preferences: Pick<PreferenceStore, "client">,
	id: string,
) => preferences.client().experiments.includes(id);

export const setExperiment = (
	preferences: Pick<PreferenceStore, "client" | "setClient">,
	id: string,
	enabled: boolean,
) => {
	const current = preferences.client().experiments;
	const next = enabled
		? [...new Set([...current, id])]
		: current.filter((entry) => entry !== id);
	return preferences.setClient({ experiments: next });
};
