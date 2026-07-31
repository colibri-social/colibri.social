import { type Component, createSignal, onMount } from "solid-js";
import { toast } from "somoto";
import { writeNotificationPreference } from "../../../atproto/notificationPreference";
import type { NotificationLevel } from "../../../atproto/xrpc/social/colibri/actor";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { enablePushNotifications, isWebRuntime } from "../../../notifications";
import { unsubscribeFcmPush } from "../../../notifications/push-fcm";
import { unsubscribeWebPush } from "../../../notifications/push-web";
import { createLogger } from "../../../utils/logger";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { SettingsPage } from "../common/SettingsModal";

const log = createLogger("settings/notifications");

export const NotificationsPage: Component = () => {
	const user = useUserContext();
	const { preferences, setNativeNotifications } = useUserPreferences();
	const [busy, setBusy] = createSignal(false);

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
			log.error("saving the notification level failed", { error: err });
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
					toast.error("Notification permission was not granted.");
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
			log.error("updating push registration failed", { error: err });
			toast.error("Failed to update notification settings.");
		} finally {
			setBusy(false);
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
		</SettingsPage>
	);
};
