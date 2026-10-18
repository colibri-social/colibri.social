import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { invite } from "./invite.contract";

export default defineScreen<AdminArgs>(invite, {
	mobile: () => import("./invite.mobile"),
	desktop: () => import("./invite.desktop"),
});
