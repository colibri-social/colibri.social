import { type Component, onCleanup, onMount } from "solid-js";
import { colibri } from "../../atproto/lexicons";
import type { ProfileView } from "../../atproto/views";
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
	type FcmSubscription,
	listenForFcmTokenRefresh,
	subscribeFcmPush,
} from "../../notifications/push-fcm";
import {
	listenForPushSubscriptionChanges,
	subscribeWebPush,
	type WebPushSubscription,
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
	author: ProfileView | undefined,
): Promise<string | undefined> => {
	if (!author?.avatar) return undefined;
	if (!(await isNativeNotificationSupported())) return undefined;

	try {
		const response = await fetch(author.avatar);
		if (!response.ok) return undefined;

		const bytes = new Uint8Array(await response.arrayBuffer());
		return await cacheNativeAvatar(author.did, bytes);
	} catch {
		return undefined;
	}
};

/**
 * Headless component that turns incoming `notificationEvent`s into native OS
 * notifications while the app is open. Renders nothing.
 *
 * Notifications are only fired when the window/tab is unfocused
 */
export const NativeNotifications: Component = () => {
	const socket = useSocketContext();
	const mutes = useMutes();
	const user = useUserContext();
	const notifications = useNotifications();
	const { preferences, setNativeNotifications, setNotificationDefaultApplied } =
		useUserPreferences();

	const registerPush = (sub: WebPushSubscription | FcmSubscription) =>
		sub.platform === "web"
			? user.xrpc.push(colibri.notification.registerPush.main, {
					body: {
						provider: "webpush",
						platform: "web",
						endpoint: sub.endpoint,
						p256dh: sub.keys.p256dh,
						auth: sub.keys.auth,
					},
				})
			: user.xrpc.push(colibri.notification.registerPush.main, {
					body: { provider: "fcm", platform: "android", token: sub.token },
				});

	const unregisterPush = (endpointOrToken: string, provider?: string) =>
		provider === "fcm"
			? user.xrpc.push(colibri.notification.unregisterPush.main, {
					body: { provider: "fcm", token: endpointOrToken },
				})
			: user.xrpc.push(colibri.notification.unregisterPush.main, {
					body: { provider: "webpush", endpoint: endpointOrToken },
				});

	const reconcilePermission = async (): Promise<void> => {
		const enabled = preferences().nativeNotifications;
		if (!enabled) return;

		const permission = await getBackend().getPermission();
		if (!isPermissionRevoked(enabled, permission)) return;

		log.warn("notifications were turned off because permission was revoked");
		setNativeNotifications(false);
		await unregisterAllPush(unregisterPush);
	};

	const reassertWebPushRegistration = async (): Promise<void> => {
		if (!isWebRuntime() || !preferences().nativeNotifications) return;
		if ((await getBackend().getPermission()) !== "granted") return;
		await subscribeWebPush(registerPush);
	};

	let fcmActive = false;

	const reassertFcmRegistration = async (): Promise<void> => {
		if (!preferences().nativeNotifications) return;
		if (!(await isAndroidTauriRuntime())) return;
		fcmActive = await subscribeFcmPush(registerPush, (token) =>
			unregisterPush(token, "fcm"),
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
			if (event.$type !== "social.colibri.beta.sync.defs#notificationEvent") {
				return;
			}
			if (fcmActive) return;
			if (!preferences().nativeNotifications) return;
			if (user.presence?.onlineState === "dnd") return;

			const notification = event.notification;
			if (mutes.isCommunityMuted(notification.community)) return;
			if (mutes.isMuted(notification.author.did)) return;
			if (!isAppUnfocused()) return;
			if (isStaleNotificationEvent(notification.indexedAt)) return;

			const author = notification.author;
			const title =
				author.displayName ||
				author.handle ||
				(notification.kind === "reply"
					? "New reply"
					: notification.kind === "message"
						? "New message"
						: notification.mentionRole
							? `Mentioned via @${notification.mentionRole}`
							: "New mention");
			const subtitle =
				notification.kind === "reply"
					? "Replied to you"
					: notification.mentionRole
						? `Mentioned you via @${notification.mentionRole}`
						: notification.kind === "mention"
							? "Mentioned you"
							: undefined;

			void (async () => {
				notify({
					title,
					subtitle,
					body: notification.message?.text || "You have a new notification.",
					tag: notification.message?.uri,
					iconPath: await avatarPathFor(author),
					data: {
						messageUri: notification.message?.uri,
						channelUri: notification.channel,
					},
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
				channel: activation.channelUri,
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
