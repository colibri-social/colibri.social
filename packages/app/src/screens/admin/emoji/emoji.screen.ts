import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminEmoji } from "./emoji.contract";

export default defineScreen<AdminArgs>(adminEmoji, {
	mobile: () => import("./emoji.mobile"),
	desktop: () => import("./emoji.desktop"),
});
