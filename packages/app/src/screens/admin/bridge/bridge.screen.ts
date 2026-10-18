import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { bridge } from "./bridge.contract";

export default defineScreen<AdminArgs>(bridge, {
	mobile: () => import("./bridge.mobile"),
	desktop: () => import("./bridge.desktop"),
});
