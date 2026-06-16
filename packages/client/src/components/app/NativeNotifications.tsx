import { type Component, onCleanup, onMount } from "solid-js";
import { useSocketContext } from "../../contexts/Socket";
import { useUserPreferences } from "../../contexts/UserPreferences";
import { notify } from "../../notifications";

/**
 * Headless component that turns incoming `notification_event`s into native OS
 * notifications while the app is open. Renders nothing.
 *
 * Notifications are only fired when the window/tab is unfocused — while the user
 * is actively looking at the app we rely on the in-app `NotificationBell` badge
 * to avoid duplicate noise. Background delivery (app fully closed) is handled by
 * the Service Worker push path, not this component.
 */
export const NativeNotifications: Component = () => {
	const socket = useSocketContext();
	const { preferences } = useUserPreferences();

	const isUnfocused = (): boolean =>
		typeof document === "undefined" ||
		document.visibilityState === "hidden" ||
		!document.hasFocus();

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (event.type !== "notification_event" || !event.data) return;
			if (!preferences().nativeNotifications) return;
			if (!isUnfocused()) return;

			const { kind, message } = event.data;
			notify({
				title: kind === "reply" ? "New reply" : "New mention",
				body: message?.text ?? "You have a new notification.",
				tag: event.data.messageUri,
				data: { messageUri: event.data.messageUri },
			});
		});

		onCleanup(cleanup);
	});

	return null;
};
