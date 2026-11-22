import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { spaceTransfer } from "./transfer.contract";

export default defineScreen<AdminArgs>(spaceTransfer, {
	mobile: () => import("./transfer.mobile"),
	desktop: () => import("./transfer.desktop"),
});
