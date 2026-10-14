import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { bridgeCode } from "./bridge-code.contract";

export default defineScreen<AdminArgs>(bridgeCode, {
	mobile: () => import("./bridge-code.mobile"),
	desktop: () => import("./bridge-code.desktop"),
});
