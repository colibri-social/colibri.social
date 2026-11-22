import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminChannelPermissions } from "./channel-permissions.contract";

export default defineScreen<AdminArgs>(adminChannelPermissions, {
	mobile: () => import("./channel-permissions.mobile"),
	desktop: () => import("./channel-permissions.desktop"),
});
