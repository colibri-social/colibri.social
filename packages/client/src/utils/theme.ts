import { createSignal } from "solid-js";
import { PREFERENCES_STORAGE_KEY } from "../contexts/UserPreferences";

export type AppTheme = "dark" | "light";

export const LIGHT_MODE_EXPERIMENT = "light-mode-v1";

const THEME_BACKGROUND: Record<AppTheme, string> = {
	dark: "#0a0a0a",
	light: "#ffffff",
};

const [resolved, setResolved] = createSignal<AppTheme>("dark");

export const resolvedTheme = resolved;

const isAppTheme = (value: unknown): value is AppTheme =>
	value === "dark" || value === "light";

export const readStoredTheme = (): {
	enabled: boolean;
	theme: AppTheme | null;
} => {
	try {
		const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
		if (!raw) return { enabled: false, theme: null };

		const parsed = JSON.parse(raw);
		return {
			enabled: parsed.experiments?.[LIGHT_MODE_EXPERIMENT] === true,
			theme: isAppTheme(parsed.theme) ? parsed.theme : null,
		};
	} catch {
		return { enabled: false, theme: null };
	}
};

export const systemTheme = (): AppTheme => {
	if (typeof window === "undefined" || !window.matchMedia) return "dark";
	return window.matchMedia("(prefers-color-scheme: light)").matches
		? "light"
		: "dark";
};

export const resolveTheme = (
	enabled: boolean,
	theme: AppTheme | null,
): AppTheme => (enabled ? (theme ?? systemTheme()) : "dark");

interface NativeSystemBars {
	setLightAppearance?: (light: boolean) => void;
}

const nativeSystemBars = (): NativeSystemBars | undefined =>
	(window as unknown as { __colibriSystemBars?: NativeSystemBars })
		.__colibriSystemBars;

export const applyTheme = (theme: AppTheme): void => {
	if (typeof document === "undefined") return;

	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
	root.dataset.kbTheme = theme;
	root.dataset.theme = theme;
	root.style.colorScheme = theme;
	root.style.backgroundColor = THEME_BACKGROUND[theme];

	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", THEME_BACKGROUND[theme]);

	nativeSystemBars()?.setLightAppearance?.(theme === "light");

	setResolved(theme);
};

export const watchSystemTheme = (
	onChange: (theme: AppTheme) => void,
): (() => void) => {
	if (typeof window === "undefined" || !window.matchMedia) return () => {};

	const query = window.matchMedia("(prefers-color-scheme: light)");
	const handleChange = (event: MediaQueryListEvent) =>
		onChange(event.matches ? "light" : "dark");

	query.addEventListener("change", handleChange);
	return () => query.removeEventListener("change", handleChange);
};

export const initTheme = (): void => {
	const { enabled, theme } = readStoredTheme();
	applyTheme(resolveTheme(enabled, theme));
};
