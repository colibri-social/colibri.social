import { defineScreen } from "../../screen/define";
import { editProfile } from "./edit-profile.contract";

export default defineScreen<Record<string, never>>(editProfile, {
	mobile: () => import("./edit-profile.mobile"),
	desktop: () => import("./edit-profile.desktop"),
});
