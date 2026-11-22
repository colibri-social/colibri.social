import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { spaceHosting } from "./hosting.contract";

export default defineScreen<AdminArgs>(spaceHosting, {
	mobile: () => import("./hosting.mobile"),
	desktop: () => import("./hosting.desktop"),
});
