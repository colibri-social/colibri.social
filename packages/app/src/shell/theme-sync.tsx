import { withoutTransitions } from "@colibri-social/ui";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { writeStored } from "../data/persist";
import type { Theme } from "../data/preferences/types";
import { useData } from "../data/store";

export const THEME_KEY = "colibri:theme";

const THEME_COLORS = { dark: "#080808", light: "#f7f7f8" } as const;

const LIGHT_QUERY = "(prefers-color-scheme: light)";

export const resolveTheme = (theme: Theme, prefersLight: boolean) =>
	theme === "system" ? (prefersLight ? "light" : "dark") : theme;

const usePrefersLight = () => {
	const query =
		typeof matchMedia === "undefined" ? undefined : matchMedia(LIGHT_QUERY);
	const [light, setLight] = createSignal(query?.matches ?? false);
	if (query) {
		const update = () => setLight(query.matches);
		query.addEventListener("change", update);
		onCleanup(() => query.removeEventListener("change", update));
	}
	return light;
};

type WindowBridge = { setLightBars: (light: boolean) => void };

const setLightSystemBars = (light: boolean) => {
	const bridge = (window as unknown as { __colibriWindow?: WindowBridge })
		.__colibriWindow;
	bridge?.setLightBars(light);
};

export const ThemeSync = () => {
	const data = useData();
	const prefersLight = usePrefersLight();
	createEffect(() => {
		const theme = data.preferences.client().theme;
		const resolved = resolveTheme(theme, prefersLight());
		writeStored(THEME_KEY, theme);
		const root = document.documentElement;
		if (root.dataset.theme !== resolved)
			withoutTransitions(() => {
				root.dataset.theme = resolved;
			});
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute("content", THEME_COLORS[resolved]);
		setLightSystemBars(resolved === "light");
	});
	return null;
};
