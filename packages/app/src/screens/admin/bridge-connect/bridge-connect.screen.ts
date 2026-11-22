import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { bridgeConnect } from "./bridge-connect.contract";

export default defineScreen<AdminArgs>(bridgeConnect, {
	mobile: () => import("./bridge-connect.mobile"),
	desktop: () => import("./bridge-connect.desktop"),
});
