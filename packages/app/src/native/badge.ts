import { createEffect, createRoot } from "solid-js";
import { isPingNotification } from "../data/notification-alerts";
import { isUnread, spaceNotificationPrefs } from "../data/notifications";
import type { DataStore } from "../data/store";
import type { NotificationView } from "../data/types";
import { resolveChromeMode } from "../shell/desktop/window-chrome";

export const BADGE_DELAY_MS = 250;

export const badgeCount = (
	items: readonly NotificationView[],
	isSpaceMuted: (space: string) => boolean,
): number =>
	items.filter(
		(view) =>
			isUnread(view) &&
			isPingNotification(view) &&
			!isSpaceMuted(view.community),
	).length;

const setPlatformBadge = async (count: number): Promise<void> => {
	const mode = resolveChromeMode();
	if (mode === "macos" || mode === "linux") {
		const { getCurrentWindow } = await import("@tauri-apps/api/window");
		await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined);
		return;
	}
	if (mode !== "none" || "__TAURI_INTERNALS__" in window) return;
	if (count > 0 && navigator.setAppBadge) await navigator.setAppBadge(count);
	else if (navigator.clearAppBadge) await navigator.clearAppBadge();
};

export const installBadge = (
	store: Pick<DataStore, "notifications"> & object,
	options: {
		set?: (count: number) => Promise<void>;
		delayMs?: number;
	} = {},
): (() => void) => {
	const set = options.set ?? setPlatformBadge;
	const delay = options.delayMs ?? BADGE_DELAY_MS;
	const prefs = spaceNotificationPrefs(store);
	let applied = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const apply = (count: number) => {
		if (count === applied) return;
		applied = count;
		void set(count).catch(() => undefined);
	};
	const dispose = createRoot((dispose) => {
		createEffect(() => {
			const count = badgeCount(store.notifications.items(), prefs.isMuted);
			clearTimeout(timer);
			timer = setTimeout(() => apply(count), delay);
		});
		return dispose;
	});
	return () => {
		dispose();
		clearTimeout(timer);
		apply(0);
	};
};
