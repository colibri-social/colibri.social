import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { overview } from "./overview.contract";

export default defineScreen<AdminArgs>(overview, {
	mobile: () => import("./overview.mobile"),
	desktop: () => import("./overview.desktop"),
});
