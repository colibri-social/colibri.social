import { type Component, createEffect, onCleanup } from "solid-js";
import { useNotifications } from "../../contexts/Notifications";
import { clearAppBadge, setAppBadge } from "../../utils/badge";

const BADGE_DEBOUNCE_MS = 250;

export const AppBadge: Component = () => {
	const notifications = useNotifications();

	let timeoutId: number | undefined;
	let lastSent = -1;

	createEffect(() => {
		const total = notifications.totalPings();

		if (timeoutId !== undefined) window.clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => {
			timeoutId = undefined;
			if (total === lastSent) return;
			lastSent = total;
			void setAppBadge(total);
		}, BADGE_DEBOUNCE_MS);
	});

	onCleanup(() => {
		if (timeoutId !== undefined) window.clearTimeout(timeoutId);
		void clearAppBadge();
	});

	return null;
};
