import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminRole } from "./role.contract";

export default defineScreen<AdminArgs>(adminRole, {
	mobile: () => import("./role.mobile"),
	desktop: () => import("./role.desktop"),
});
