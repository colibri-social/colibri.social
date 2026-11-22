import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { members } from "./members.contract";

export default defineScreen<AdminArgs>(members, {
	mobile: () => import("./members.mobile"),
	desktop: () => import("./members.desktop"),
});
