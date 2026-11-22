import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminCategoryAudience } from "./category-audience.contract";

export default defineScreen<AdminArgs>(adminCategoryAudience, {
	mobile: () => import("./category-audience.mobile"),
	desktop: () => import("./category-audience.desktop"),
});
