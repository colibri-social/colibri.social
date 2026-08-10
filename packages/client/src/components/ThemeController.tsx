import { type Component, createEffect, onCleanup } from "solid-js";
import { useUserPreferences } from "../contexts/UserPreferences";
import { useExperiment } from "../experiments";
import {
	applyTheme,
	LIGHT_MODE_EXPERIMENT,
	resolveTheme,
	watchSystemTheme,
} from "../utils/theme";

export const ThemeController: Component = () => {
	const { preferences } = useUserPreferences();
	const lightModeEnabled = useExperiment(LIGHT_MODE_EXPERIMENT);

	createEffect(() => {
		const enabled = lightModeEnabled();
		const stored = preferences().theme;

		applyTheme(resolveTheme(enabled, stored));

		if (!enabled || stored !== null) return;

		onCleanup(watchSystemTheme(applyTheme));
	});

	return null;
};
