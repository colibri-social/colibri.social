import type { ActorData } from "@colibri-social/lib";
import { type Component, onCleanup, onMount } from "solid-js";
import { resolveBlob } from "../../atproto/resolve-blob";
import { useActorCache } from "../../contexts/ActorCache";
import { useMutes } from "../../contexts/Mutes";
import { useNotifications } from "../../contexts/Notifications";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { useUserPreferences } from "../../contexts/UserPreferences";
import {
	getBackend,
	isAndroidTauriRuntime,
	isAppUnfocused,
	isPermissionRevoked,
	isStaleNotificationEvent,
	isTauriRuntime,
	isWebRuntime,
	notify,
	unregisterAllPush,
	watchNotificationPermission,
} from "../../notifications";
import {
	ackMarkRead,
	listenForPendingMarkRead,
	readPendingMarkRead,
} from "../../notifications/mark-read-queue";
import {
	listenForFcmTokenRefresh,
	subscribeFcmPush,
} from "../../notifications/push-fcm";
import {
	listenForPushSubscriptionChanges,
	subscribeWebPush,
} from "../../notifications/push-web";
import {
	cacheNativeAvatar,
	isNativeNotificationSupported,
	listenForNativeActivation,
} from "../../notifications/tauri-native";
import { createLogger } from "../../utils/logger";
import { isDesktopNative } from "../../utils/platform";

// Re-assert the push registration this often while the app stays open, on
// top of the on-foreground re-assertion below. Self-healing for the case
// where the AppView pruned our `push_subscriptions` row (e.g. after a 404/410
// from Web Push or an `UNREGISTERED` FCM response) without us knowing —
// `subscribeWebPush`/`subscribeFcmPush` reuse the existing
// browser/device subscription and re-register it, so this is a cheap
// idempotent no-op when nothing was actually lost.
const PUSH_REASSERT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const log = createLogger("notif/permission");

const avatarPathFor = async (
	author: ActorData | undefined,
): Promise<string | undefined> => {
	if (!author?.data.avatar) return undefined;
	if (!(await isNativeNotificationSupported())) return undefined;

	const url = resolveBlob(author.did, author.data.avatar, "small");
	if (!url) return undefined;

	try {
		const response = await fetch(url);
		if (!response.ok) return undefined;

		const bytes = new Uint8Array(await response.arrayBuffer());
		return await cacheNativeAvatar(author.did, bytes);
	} catch {
		return undefined;
	}
};

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
	const actors = useActorCache();
	const notifications = useNotifications();
	const { preferences, setNativeNotifications, setNotificationDefaultApplied } =
		useUserPreferences();

	const reconcilePermission = async (): Promise<void> => {
		const enabled = preferences().nativeNotifications;
		if (!enabled) return;

		const permission = await getBackend().getPermission();
		if (!isPermissionRevoked(enabled, permission)) return;

		log.warn("notifications were turned off because permission was revoked");
		setNativeNotifications(false);
		await unregisterAllPush((endpoint, provider) =>
			user.xrpc.social.colibri.notification.unregisterPush(endpoint, provider),
		);
	};

	const reassertWebPushRegistration = async (): Promise<void> => {
		if (!isWebRuntime() || !preferences().nativeNotifications) return;
		if ((await getBackend().getPermission()) !== "granted") return;
		await subscribeWebPush((sub) =>
			user.xrpc.social.colibri.notification.registerPush(sub),
		);
	};

	let fcmActive = false;

	const reassertFcmRegistration = async (): Promise<void> => {
		if (!preferences().nativeNotifications) return;
		if (!(await isAndroidTauriRuntime())) return;
		fcmActive = await subscribeFcmPush(
			(sub) => user.xrpc.social.colibri.notification.registerPush(sub),
			(token) =>
				user.xrpc.social.colibri.notification.unregisterPush(token, "fcm"),
		);
	};

	onMount(() => {
		void (async () => {
			if (isTauriRuntime()) {
				const backend = getBackend();
				const permission = await backend.getPermission();

				if (isDesktopNative()) {
					if (
						permission === "granted" &&
						!preferences().notificationDefaultApplied
					) {
						setNativeNotifications(true);
						setNotificationDefaultApplied(true);
					}
					// OS permission is only ever "default" before the user has been
					// asked, so this only prompts once per install
				} else if (permission === "default") {
					const requested = await backend.requestPermission();
					if (requested === "granted") setNativeNotifications(true);
				}

				await reconcilePermission();
				await reassertFcmRegistration();
				return;
			}

			await reconcilePermission();
			await reassertWebPushRegistration();
		})();

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void reconcilePermission();
				void reassertWebPushRegistration();
				void reassertFcmRegistration();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		const intervalId = window.setInterval(() => {
			void reassertWebPushRegistration();
			void reassertFcmRegistration();
		}, PUSH_REASSERT_INTERVAL_MS);
		const cleanupPushChangeListener = listenForPushSubscriptionChanges(() => {
			void reassertWebPushRegistration();
		});
		const cleanupPermissionWatcher = watchNotificationPermission(() => {
			void reconcilePermission();
		});
		let cleanupFcmTokenRefreshListener = () => {};
		void listenForFcmTokenRefresh(() => {
			void reassertFcmRegistration();
		}).then((cleanup) => {
			cleanupFcmTokenRefreshListener = cleanup;
		});
		onCleanup(() => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.clearInterval(intervalId);
			cleanupPushChangeListener();
			cleanupPermissionWatcher();
			cleanupFcmTokenRefreshListener();
		});

		const cleanup = socket.onEvent((event) => {
			if (event.type !== "notification_event" || !event.data) return;
			if (fcmActive) return;
			if (!preferences().nativeNotifications) return;
			if (user.data.onlineState === "dnd") return;
			if (mutes.isChannelMuted(event.data.channelUri)) return;
			if (!isAppUnfocused()) return;
			if (isStaleNotificationEvent(event.data.indexedAt)) return;

			const {
				kind,
				message,
				mentionRoleName,
				authorDid,
				messageUri,
				channelUri,
			} = event.data;
			const author = actors.resolve(authorDid);
			const title =
				author?.data.displayName ||
				author?.handle ||
				(kind === "reply"
					? "New reply"
					: kind === "message"
						? "New message"
						: mentionRoleName
							? `Mentioned via @${mentionRoleName}`
							: "New mention");
			const subtitle =
				kind === "reply"
					? "Replied to you"
					: mentionRoleName
						? `Mentioned you via @${mentionRoleName}`
						: kind === "mention"
							? "Mentioned you"
							: undefined;

			void (async () => {
				notify({
					title,
					subtitle,
					body: message?.text || "You have a new notification.",
					tag: messageUri,
					iconPath: await avatarPathFor(author),
					data: { messageUri, channelUri },
				});
			})();
		});

		onCleanup(cleanup);

		let draining = false;
		const drainMarkReadQueue = async (): Promise<void> => {
			if (draining) return;
			draining = true;
			try {
				for (const entry of readPendingMarkRead()) {
					await notifications.markChannelReadUpTo(
						entry.channelUri,
						entry.messageUri,
						entry.actionedAt,
					);
					ackMarkRead(entry.channelUri);
				}
			} finally {
				draining = false;
			}
		};

		void drainMarkReadQueue();
		onCleanup(listenForPendingMarkRead(() => void drainMarkReadQueue()));

		let cleanupActivation = () => {};
		void listenForNativeActivation((activation) => {
			notifications.openNotification({
				channelUri: activation.channelUri,
				messageUri: activation.messageUri,
				indexedAt: new Date().toISOString(),
			});
		}).then((cleanup) => {
			cleanupActivation = cleanup;
		});
		onCleanup(() => cleanupActivation());
	});

	return null;
};
