import { classifyThrown } from "../errors";
import { isTauriRuntime } from "../notifications/environment";
import { createLogger } from "./logger";
import { isWindows } from "./platform";

const log = createLogger("badge");

declare global {
	interface Navigator {
		setAppBadge?: (count?: number) => Promise<void>;
		clearAppBadge?: () => Promise<void>;
	}
}

const applyNative = async (count: number): Promise<void> => {
	if (isWindows()) {
		// FIXME: Badges on Windows need overlay
		return;
	}

	const { getCurrentWindow } = await import("@tauri-apps/api/window");
	await getCurrentWindow().setBadgeCount(count === 0 ? undefined : count);
};

const applyWeb = async (count: number): Promise<void> => {
	if (typeof navigator === "undefined") return;
	if (count === 0) {
		await navigator.clearAppBadge?.();
		return;
	}
	await navigator.setAppBadge?.(count);
};

export const setAppBadge = async (count: number): Promise<void> => {
	const safe = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;

	try {
		if (isTauriRuntime()) {
			await applyNative(safe);
			return;
		}
		await applyWeb(safe);
	} catch (err) {
		log.debug("setting the app badge failed", {
			code: classifyThrown(err).code,
		});
	}
};

export const clearAppBadge = async (): Promise<void> => setAppBadge(0);
