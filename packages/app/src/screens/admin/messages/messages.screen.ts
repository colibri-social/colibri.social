import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { spaceMessages } from "./messages.contract";

export default defineScreen<AdminArgs>(spaceMessages, {
	mobile: () => import("./messages.mobile"),
	desktop: () => import("./messages.desktop"),
});
