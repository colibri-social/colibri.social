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

/**
 * True for the native desktop macOS app specifically, not iOS/Android. iPadOS
 * deliberately reports a "Macintosh" user agent (to get the desktop site), so
 * that alone can't distinguish real macOS from an iPad; `maxTouchPoints` can,
 * since only a genuine non-touch Mac reports 0 (this is Apple's own
 * documented technique for detecting iPad-pretending-to-be-Mac).
 */
export const isMacosTauriRuntime = (): boolean =>
	isTauriRuntime() &&
	typeof navigator !== "undefined" &&
	navigator.maxTouchPoints === 0;
