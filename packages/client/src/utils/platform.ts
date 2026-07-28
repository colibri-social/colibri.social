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
