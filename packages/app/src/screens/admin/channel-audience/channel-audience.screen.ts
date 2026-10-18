import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminChannelAudience } from "./channel-audience.contract";

export default defineScreen<AdminArgs>(adminChannelAudience, {
	mobile: () => import("./channel-audience.mobile"),
	desktop: () => import("./channel-audience.desktop"),
});
