import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { invites } from "./invites.contract";

export default defineScreen<AdminArgs>(invites, {
	mobile: () => import("./invites.mobile"),
	desktop: () => import("./invites.desktop"),
});
