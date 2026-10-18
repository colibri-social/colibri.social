import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminCategory } from "./category.contract";

export default defineScreen<AdminArgs>(adminCategory, {
	mobile: () => import("./category.mobile"),
	desktop: () => import("./category.desktop"),
});
