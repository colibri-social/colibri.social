import { type Component, createSignal } from "solid-js";
import { toast } from "somoto";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { getBackend, isWebRuntime } from "../../../notifications";
import {
	subscribeWebPush,
	unsubscribeWebPush,
} from "../../../notifications/push-web";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { SettingsPage } from "../common/SettingsModal";

export const NotificationsPage: Component = () => {
	const user = useUserContext();
	const { preferences, setNativeNotifications } = useUserPreferences();
	const [busy, setBusy] = createSignal(false);

	const handleChange = async (enabled: boolean) => {
		setBusy(true);
		try {
			if (enabled) {
				// Permission must be requested from this user gesture.
				const permission = await getBackend().requestPermission();
				if (permission !== "granted") {
					toast.error("Notification permission was not granted.");
					return;
				}

				setNativeNotifications(true);

				// On the web, also register a push subscription so notifications
				// arrive while the app is closed.
				if (isWebRuntime()) {
					await subscribeWebPush((sub) =>
						user.xrpc.social.colibri.notification.registerPush(sub),
					);
				}
			} else {
				setNativeNotifications(false);
				if (isWebRuntime()) {
					await unsubscribeWebPush((endpoint) =>
						user.xrpc.social.colibri.notification.unregisterPush(endpoint),
					);
				}
			}
		} catch (err) {
			console.error(err);
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
					<SwitchLabel>Desktop notifications</SwitchLabel>
					<SwitchDescription class="max-w-120">
						Show native OS notifications for mentions and replies when the app
						is unfocused or closed.
					</SwitchDescription>
				</div>
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</Switch>
		</SettingsPage>
	);
};
