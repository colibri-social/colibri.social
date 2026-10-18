import { NotificationSettings } from "@colibri-social/ui";
import { createSignal, onCleanup } from "solid-js";
import { useData } from "../../../data/store";
import { deviceNotifications } from "../../../native/notifications/device";
import {
	type OsNotifier,
	osNotifier,
} from "../../../native/notifications/index";

export default function NotificationsPage() {
	const data = useData();
	const device = deviceNotifications();
	const [notifier, setNotifier] = createSignal<OsNotifier>();
	void osNotifier().then(setNotifier);
	onCleanup(device.watch());
	const supported = () => {
		const kind = notifier()?.kind;
		return !!kind && kind !== "none";
	};
	return (
		<NotificationSettings
			level={data.preferences.notificationLevel()}
			onLevelChange={(level) =>
				void data.preferences.setNotificationLevel(level)
			}
			device={
				supported()
					? {
							enabled: device.enabled(),
							onChange: (enabled) => void device.setEnabled(enabled),
							blocked: device.permission() === "denied",
							place: notifier()?.kind === "web" ? "browser" : "system",
							busy: device.busy(),
						}
					: undefined
			}
		/>
	);
}
