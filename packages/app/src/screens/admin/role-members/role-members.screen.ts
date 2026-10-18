import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminRoleMembers } from "../role/role-pages";

export default defineScreen<AdminArgs>(adminRoleMembers, {
	mobile: () => import("./role-members.mobile"),
	desktop: () => import("./role-members.desktop"),
});
