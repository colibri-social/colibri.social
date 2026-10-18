import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { spaceProfile } from "./profile.contract";

export default defineScreen<AdminArgs>(spaceProfile, {
	mobile: () => import("./profile.mobile"),
	desktop: () => import("./profile.desktop"),
});
