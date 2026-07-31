import { platform } from "@tauri-apps/plugin-os";
import { isTauriRuntime } from "../notifications/environment";

const IAP_PLATFORMS = ["macos", "ios", "android"];

export const requiresInAppPurchase = (): boolean => {
	if (!isTauriRuntime()) return false;

	try {
		return IAP_PLATFORMS.includes(platform());
	} catch {
		return /Mac|iPhone|iPad|iPod|Android/.test(navigator.userAgent);
	}
};

const NATIVE_KEYBOARD_INSET_PLATFORMS = ["android", "ios"];

/**
 * True when running inside the Tauri Android or iOS webview
 */
export const hasNativeKeyboardInsetSync = (): boolean => {
	if (!isTauriRuntime()) return false;

	try {
		return NATIVE_KEYBOARD_INSET_PLATFORMS.includes(platform());
	} catch {
		return false;
	}
};
