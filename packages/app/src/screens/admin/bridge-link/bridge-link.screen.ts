import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { bridgeLink } from "./bridge-link.contract";

export default defineScreen<AdminArgs>(bridgeLink, {
	mobile: () => import("./bridge-link.mobile"),
	desktop: () => import("./bridge-link.desktop"),
});
