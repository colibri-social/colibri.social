import { invoke } from "@tauri-apps/api/core";
import { PREFERENCES_STORAGE_KEY } from "../contexts/UserPreferences";
import { isTauriRuntime } from "../notifications/environment";
import { desktopOs, isDesktopNative } from "./platform";

export type TitleBarMode = "web" | "macos" | "windows" | "linux" | "none";

const DEV_MODE_KEY = "colibri:titlebar-mode";

const TITLE_BAR_MODES: ReadonlyArray<TitleBarMode> = [
	"web",
	"macos",
	"windows",
	"linux",
	"none",
];

const isTitleBarMode = (value: string | null): value is TitleBarMode =>
	value !== null && TITLE_BAR_MODES.includes(value as TitleBarMode);

export const readNativeDecorationsPreference = (): boolean => {
	try {
		const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
		if (!raw) return false;
		return JSON.parse(raw).nativeWindowDecorations === true;
	} catch {
		return false;
	}
};

const readDevOverride = (): TitleBarMode | null => {
	if (!import.meta.env.DEV || typeof window === "undefined") return null;

	try {
		const fromQuery = new URLSearchParams(location.search).get("titlebar");
		if (isTitleBarMode(fromQuery)) return fromQuery;

		const stored = localStorage.getItem(DEV_MODE_KEY);
		if (isTitleBarMode(stored)) return stored;
	} catch {}

	return null;
};

export const resolveTitleBarMode = (): TitleBarMode => {
	const override = readDevOverride();
	if (override) return override;

	const os = desktopOs();
	if (os === null) return isTauriRuntime() ? "none" : "web";
	return os;
};

export const applyTitleBarMode = (
	mode: TitleBarMode = resolveTitleBarMode(),
): void => {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.titlebar = mode;
};

export const applyNativeDecorations = async (
	enabled: boolean,
): Promise<void> => {
	if (!isDesktopNative()) return;

	try {
		await invoke("titlebar_set_native_decorations", { enabled });
	} catch {}
};

export const initTitleBar = (): void => {
	applyTitleBarMode();

	if (isDesktopNative() && readNativeDecorationsPreference()) {
		void applyNativeDecorations(true);
	}
};

export const titleBarHeightPx = (): number => {
	if (typeof document === "undefined") return 0;
	return (
		Number.parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue(
				"--titlebar-height",
			),
		) || 0
	);
};
