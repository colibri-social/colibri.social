import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { bridges } from "./bridges.contract";

export default defineScreen<AdminArgs>(bridges, {
	mobile: () => import("./bridges.mobile"),
	desktop: () => import("./bridges.desktop"),
});
