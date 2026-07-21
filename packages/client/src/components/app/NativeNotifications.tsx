import { type Component, onCleanup, onMount } from "solid-js";
import { useMutes } from "../../contexts/Mutes";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { useUserPreferences } from "../../contexts/UserPreferences";
import {
	getBackend,
	isTauriRuntime,
	isWebRuntime,
	notify,
} from "../../notifications";
import {
	listenForPushSubscriptionChanges,
	subscribeWebPush,
} from "../../notifications/push-web";

// Re-assert the web push subscription this often while the app stays open,
// on top of the on-foreground re-assertion below. Self-healing for the case
// where the AppView pruned our `push_subscriptions` row (e.g. after a 404/410
// from the push service) without us knowing — `subscribeWebPush` reuses the
// existing browser subscription and re-registers it, so this is a cheap
// idempotent no-op when nothing was actually lost.
const PUSH_REASSERT_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
	const { preferences, setNativeNotifications } = useUserPreferences();

	const isUnfocused = (): boolean =>
		typeof document === "undefined" ||
		document.visibilityState === "hidden" ||
		!document.hasFocus();

	const reassertWebPushRegistration = async (): Promise<void> => {
		if (!isWebRuntime() || !preferences().nativeNotifications) return;
		if ((await getBackend().getPermission()) !== "granted") return;
		await subscribeWebPush((sub) =>
			user.xrpc.social.colibri.notification.registerPush(sub),
		);
	};

	onMount(() => {
		void (async () => {
			if (isTauriRuntime()) {
				const backend = getBackend();
				// OS permission is only ever "default" before the user has been
				// asked, so this only prompts once per install
				if ((await backend.getPermission()) === "default") {
					const permission = await backend.requestPermission();
					if (permission === "granted") setNativeNotifications(true);
				}
				return;
			}

			await reassertWebPushRegistration();
		})();

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void reassertWebPushRegistration();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		const intervalId = window.setInterval(
			() => void reassertWebPushRegistration(),
			PUSH_REASSERT_INTERVAL_MS,
		);
		const cleanupPushChangeListener = listenForPushSubscriptionChanges(() => {
			void reassertWebPushRegistration();
		});
		onCleanup(() => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.clearInterval(intervalId);
			cleanupPushChangeListener();
		});

		const cleanup = socket.onEvent((event) => {
			if (event.type !== "notification_event" || !event.data) return;
			if (!preferences().nativeNotifications) return;
			if (user.data.onlineState === "dnd") return;
			if (mutes.isChannelMuted(event.data.channelUri)) return;
			if (!isUnfocused()) return;

			const { kind, message, mentionRoleName } = event.data;
			const title =
				kind === "reply"
					? "New reply"
					: kind === "message"
						? "New message"
						: mentionRoleName
							? `Mentioned via @${mentionRoleName}`
							: "New mention";
			notify({
				title,
				body: message?.text ?? "You have a new notification.",
				tag: event.data.messageUri,
				data: { messageUri: event.data.messageUri },
			});
		});

		onCleanup(cleanup);
	});

	return null;
};
