import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { bridgeNew } from "./bridge-new.contract";

export default defineScreen<AdminArgs>(bridgeNew, {
	mobile: () => import("./bridge-new.mobile"),
	desktop: () => import("./bridge-new.desktop"),
});
