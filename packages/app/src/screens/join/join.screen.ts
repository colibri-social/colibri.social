import { defineScreen } from "../../screen/define";
import { type JoinArgs, join } from "./join.contract";

export default defineScreen<JoinArgs>(join, {
	mobile: () => import("./join.mobile"),
	desktop: () => import("./join.desktop"),
});
