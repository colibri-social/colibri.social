/**
 * Runtime environment detection for the notification layer.
 *
 * The same client bundle runs both as an Astro Solid island in a browser and
 * (in the future) inside a Tauri v2 webview, so the notification backend has to
 * be picked at runtime rather than at build time.
 */

/** True when running inside a Tauri v2 webview. */
export const isTauriRuntime = (): boolean =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** True when running in a regular browser with the Notification API available. */
export const isWebRuntime = (): boolean =>
	typeof window !== "undefined" &&
	!isTauriRuntime() &&
	"Notification" in window;

export const isAndroidTauriRuntime = async (): Promise<boolean> => {
	if (!isTauriRuntime()) return false;
	const { platform } = await import("@tauri-apps/plugin-os");
	return platform() === "android";
};

export const isAppUnfocused = (): boolean =>
	typeof document === "undefined" ||
	document.visibilityState === "hidden" ||
	!document.hasFocus();
