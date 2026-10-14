import { defineScreen } from "../../screen/define";
import { profile } from "./profile.contract";

export default defineScreen<Record<string, never>>(profile, {
	mobile: () => import("./profile.mobile"),
	desktop: () => import("./profile.desktop"),
});
