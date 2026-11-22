import { defineScreen } from "../../screen/define";
import { type MembersArgs, members } from "./members.contract";

export default defineScreen<MembersArgs>(members, {
	mobile: () => import("./members.mobile"),
	desktop: () => import("./members.desktop"),
});
