import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminRoles } from "./roles.contract";

export default defineScreen<AdminArgs>(adminRoles, {
	mobile: () => import("./roles.mobile"),
	desktop: () => import("./roles.desktop"),
});
