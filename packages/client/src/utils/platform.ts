import { platform } from "@tauri-apps/plugin-os";
import { isTauriRuntime } from "../notifications/environment";

const resolveNativePlatform = (): string | null => {
	if (!isTauriRuntime()) return null;

	try {
		return platform();
	} catch {
		return null;
	}
};

const NATIVE_PLATFORM = resolveNativePlatform();

export type DesktopOs = "macos" | "windows" | "linux";

const DESKTOP_PLATFORMS: ReadonlyArray<string> = ["macos", "windows", "linux"];

export const nativePlatform = (): string | null => NATIVE_PLATFORM;

export const desktopOs = (): DesktopOs | null =>
	NATIVE_PLATFORM !== null && DESKTOP_PLATFORMS.includes(NATIVE_PLATFORM)
		? (NATIVE_PLATFORM as DesktopOs)
		: null;

export const isDesktopNative = (): boolean => desktopOs() !== null;

export const isMacOS = (): boolean => desktopOs() === "macos";

export const isWindows = (): boolean => desktopOs() === "windows";

export const isLinux = (): boolean => desktopOs() === "linux";

const IAP_PLATFORMS = ["macos", "ios", "android"];

export const requiresInAppPurchase = (): boolean => {
	if (!isTauriRuntime()) return false;

	if (NATIVE_PLATFORM === null) {
		return /Mac|iPhone|iPad|iPod|Android/.test(navigator.userAgent);
	}

	return IAP_PLATFORMS.includes(NATIVE_PLATFORM);
};

const NATIVE_KEYBOARD_INSET_PLATFORMS = ["android", "ios"];

/**
 * True when running inside the Tauri Android or iOS webview
 */
export const hasNativeKeyboardInsetSync = (): boolean =>
	NATIVE_PLATFORM !== null &&
	NATIVE_KEYBOARD_INSET_PLATFORMS.includes(NATIVE_PLATFORM);
