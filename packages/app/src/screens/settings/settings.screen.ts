import { defineScreen } from "../../screen/define";
import { type SettingsArgs, settings } from "./settings.contract";

export default defineScreen<SettingsArgs>(settings, {
	mobile: () => import("./settings.mobile"),
	desktop: () => import("./settings.desktop"),
});
