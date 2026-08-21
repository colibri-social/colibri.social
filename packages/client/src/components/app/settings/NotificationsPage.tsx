import {
	type Component,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { toast } from "somoto";
import { writeNotificationPreference } from "../../../atproto/notificationPreference";
import { resolveBlob } from "../../../atproto/resolve-blob";
import type { NotificationLevel } from "../../../atproto/xrpc/social/colibri/actor";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { classifyThrown } from "../../../errors";
import {
	enablePushNotifications,
	getBackend,
	isWebRuntime,
	type NotificationPermission,
	notify,
	watchNotificationPermission,
} from "../../../notifications";
import { unsubscribeFcmPush } from "../../../notifications/push-fcm";
import { unsubscribeWebPush } from "../../../notifications/push-web";
import {
	cacheNativeAvatar,
	isNativeNotificationSupported,
} from "../../../notifications/tauri-native";
import { setAppBadge } from "../../../utils/badge";
import { createLogger } from "../../../utils/logger";
import { Button } from "../../ui/Button";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { SettingsPage } from "../common/SettingsModal";

const log = createLogger("settings/notifications");

const TEST_TOOLS_STORAGE_KEY = "colibri:notification-tools";

const blockedSettingsName = (): string =>
	isWebRuntime() ? "browser" : "system";

const showTestTools = (): boolean => {
	if (import.meta.env.DEV) return true;
	if (typeof localStorage === "undefined") return false;
	try {
		return localStorage.getItem(TEST_TOOLS_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
};

export const NotificationsPage: Component = () => {
	const user = useUserContext();
	const { preferences, setNativeNotifications } = useUserPreferences();
	const [busy, setBusy] = createSignal(false);
	const [testBusy, setTestBusy] = createSignal(false);
	const [permissionState, setPermissionState] =
		createSignal<NotificationPermission>("unknown");

	const refreshPermission = async (): Promise<void> => {
		setPermissionState(await getBackend().getPermission());
	};

	onMount(() => {
		void refreshPermission();
		onCleanup(
			watchNotificationPermission(() => {
				void refreshPermission();
			}),
		);
	});

	const sendTestNotification = async () => {
		setTestBusy(true);
		try {
			const channelUri = `at://${user.did}/social.colibri.channel.text/test`;
			const messageUri = `at://${user.did}/social.colibri.channel.message/${Date.now()}`;
			let iconPath: string | undefined;

			if (user.data.avatar) {
				const url = resolveBlob(user.did, user.data.avatar, "small");
				if (url && (await isNativeNotificationSupported())) {
					try {
						const response = await fetch(url);
						if (response.ok) {
							iconPath = await cacheNativeAvatar(
								user.did,
								new Uint8Array(await response.arrayBuffer()),
							);
						}
					} catch {}
				}
			}

			await notify({
				title: user.data.displayName || user.handle,
				subtitle: "Mentioned you",
				body: "This is a test notification. If you can see this, notifications are working.",
				tag: messageUri,
				iconPath,
				data: { channelUri, messageUri },
			});
		} catch (err) {
			log.error("sending the test notification failed", {
				code: classifyThrown(err).code,
			});
			toast.error("Failed to send the test notification.");
		} finally {
			setTestBusy(false);
		}
	};

	const [testBadge, setTestBadge] = createSignal(0);

	const bumpTestBadge = async () => {
		const next = testBadge() + 1;
		setTestBadge(next);
		await setAppBadge(next);
	};

	const resetTestBadge = async () => {
		setTestBadge(0);
		await setAppBadge(0);
	};

	const [level, setLevel] = createSignal<NotificationLevel>("all");
	const [levelBusy, setLevelBusy] = createSignal(false);

	onMount(async () => {
		const res =
			await user.xrpc.social.colibri.actor.getNotificationPreference();
		if (res.ok && res.data) setLevel(res.data.level);
	});

	const handleLevelChange = async (onlyMentionsAndReplies: boolean) => {
		const next: NotificationLevel = onlyMentionsAndReplies
			? "mentionsAndReplies"
			: "all";
		const previous = level();
		setLevel(next);
		setLevelBusy(true);
		try {
			await writeNotificationPreference(user.atproto.agent, user.did, next);
		} catch (err) {
			log.error("saving the notification level failed", {
				code: classifyThrown(err).code,
			});
			setLevel(previous);
			toast.error("Failed to update notification level.");
		} finally {
			setLevelBusy(false);
		}
	};

	const handleChange = async (enabled: boolean) => {
		setBusy(true);
		try {
			if (enabled) {
				const permission = await enablePushNotifications(
					(sub) => user.xrpc.social.colibri.notification.registerPush(sub),
					(endpoint, provider) =>
						user.xrpc.social.colibri.notification.unregisterPush(
							endpoint,
							provider,
						),
				);
				if (permission !== "granted") {
					toast.error(
						permission === "denied"
							? `Notifications are blocked. Allow them in your ${blockedSettingsName()} settings and try again.`
							: "Notification permission was not granted.",
					);
					return;
				}

				setNativeNotifications(true);
			} else {
				setNativeNotifications(false);
				if (isWebRuntime()) {
					await unsubscribeWebPush((endpoint) =>
						user.xrpc.social.colibri.notification.unregisterPush(endpoint),
					);
				}
				await unsubscribeFcmPush((token) =>
					user.xrpc.social.colibri.notification.unregisterPush(token, "fcm"),
				);
			}
		} catch (err) {
			log.error("updating push registration failed", {
				code: classifyThrown(err).code,
			});
			toast.error("Failed to update notification settings.");
		} finally {
			setBusy(false);
			void refreshPermission();
		}
	};

	return (
		<SettingsPage loading={busy} title="Notifications">
			<Switch
				class="flex flex-row items-center justify-between gap-4"
				checked={preferences().nativeNotifications}
				onChange={handleChange}
				disabled={busy()}
			>
				<div class="flex flex-col gap-1">
					<SwitchLabel>Notifications</SwitchLabel>
					<SwitchDescription class="max-w-120">
						Show native OS notifications when the app is unfocused or closed.
					</SwitchDescription>
					<Show when={permissionState() === "denied"}>
						<span class="max-w-120 text-sm text-destructive">
							Colibri is blocked from sending notifications. Allow them in your{" "}
							{blockedSettingsName()} settings, then turn this back on.
						</span>
					</Show>
				</div>
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</Switch>
			<Switch
				class="flex flex-row items-center justify-between gap-4"
				checked={level() === "mentionsAndReplies"}
				onChange={handleLevelChange}
				disabled={levelBusy()}
			>
				<div class="flex flex-col gap-1">
					<SwitchLabel>Only mentions & replies</SwitchLabel>
					<SwitchDescription class="max-w-120">
						By default you're notified for every message. Turn this on to only
						be notified when you're mentioned or replied to.
					</SwitchDescription>
				</div>
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</Switch>
			<Show when={showTestTools()}>
				<div class="flex flex-row items-center justify-between gap-4">
					<div class="flex flex-col gap-1">
						<span class="text-sm font-medium">Test notification</span>
						<span class="text-sm text-muted-foreground max-w-120">
							Sends yourself a sample notification so you can check how it looks
							and that it arrives.
						</span>
					</div>
					<Button
						variant="outline"
						onClick={sendTestNotification}
						disabled={testBusy() || !preferences().nativeNotifications}
					>
						Send
					</Button>
				</div>
				<div class="flex flex-row items-center justify-between gap-4">
					<div class="flex flex-col gap-1">
						<span class="text-sm font-medium">Test app icon badge</span>
						<span class="text-sm text-muted-foreground max-w-120">
							Counts up on the app icon so you can check the badge renders, and
							that clearing it removes the badge rather than showing a zero.
							Real unread mentions take over again as soon as one arrives.
						</span>
					</div>
					<div class="flex flex-row items-center gap-2 shrink-0">
						<Button variant="outline" onClick={bumpTestBadge}>
							Add ({testBadge()})
						</Button>
						<Button
							variant="outline"
							onClick={resetTestBadge}
							disabled={testBadge() === 0}
						>
							Clear
						</Button>
					</div>
				</div>
			</Show>
		</SettingsPage>
	);
};
