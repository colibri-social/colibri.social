import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminCategoryPermissions } from "./category-permissions.contract";

export default defineScreen<AdminArgs>(adminCategoryPermissions, {
	mobile: () => import("./category-permissions.mobile"),
	desktop: () => import("./category-permissions.desktop"),
});
