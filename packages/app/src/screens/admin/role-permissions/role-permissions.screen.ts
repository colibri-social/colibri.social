import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminRolePermissions } from "../role/role-pages";

export default defineScreen<AdminArgs>(adminRolePermissions, {
	mobile: () => import("./role-permissions.mobile"),
	desktop: () => import("./role-permissions.desktop"),
});
