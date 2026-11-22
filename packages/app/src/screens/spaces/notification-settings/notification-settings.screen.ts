import { defineScreen } from "../../../screen/define";
import {
	type NotificationSettingsArgs,
	notificationSettings,
} from "./notification-settings.contract";

export default defineScreen<NotificationSettingsArgs>(notificationSettings, {
	mobile: () => import("./notification-settings.mobile"),
	desktop: () => import("./notification-settings.desktop"),
});
