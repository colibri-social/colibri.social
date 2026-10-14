import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminChannel } from "./channel.contract";

export default defineScreen<AdminArgs>(adminChannel, {
	mobile: () => import("./channel.mobile"),
	desktop: () => import("./channel.desktop"),
});
