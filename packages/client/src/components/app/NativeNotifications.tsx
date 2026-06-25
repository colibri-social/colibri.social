import { type Component, onCleanup, onMount } from "solid-js";
import { useMutes } from "../../contexts/Mutes";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { useUserPreferences } from "../../contexts/UserPreferences";
import { getBackend, isWebRuntime, notify } from "../../notifications";
import { subscribeWebPush } from "../../notifications/push-web";

/**
 * Headless component that turns incoming `notification_event`s into native OS
 * notifications while the app is open. Renders nothing.
 *
 * Notifications are only fired when the window/tab is unfocused
 */
export const NativeNotifications: Component = () => {
	const socket = useSocketContext();
	const mutes = useMutes();
	const user = useUserContext();
	const { preferences } = useUserPreferences();

	const isUnfocused = (): boolean =>
		typeof document === "undefined" ||
		document.visibilityState === "hidden" ||
		!document.hasFocus();

	onMount(() => {
		void (async () => {
			if (
				isWebRuntime() &&
				preferences().nativeNotifications &&
				(await getBackend().getPermission()) === "granted"
			) {
				await subscribeWebPush((sub) =>
					user.xrpc.social.colibri.notification.registerPush(sub),
				);
			}
		})();

		const cleanup = socket.onEvent((event) => {
			if (event.type !== "notification_event" || !event.data) return;
			if (!preferences().nativeNotifications) return;
			if (user.data.onlineState === "dnd") return;
			if (mutes.isChannelMuted(event.data.channelUri)) return;
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
