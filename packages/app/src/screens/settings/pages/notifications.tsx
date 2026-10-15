import { NotificationSettings } from "@colibri-social/ui";
import { useData } from "../../../data/store";

export default function NotificationsPage() {
	const data = useData();
	return (
		<NotificationSettings
			level={data.preferences.notificationLevel()}
			onLevelChange={(level) =>
				void data.preferences.setNotificationLevel(level)
			}
		/>
	);
}
