import { defineScreen } from "../../screen/define";
import { type ThreadArgs, thread } from "./thread.contract";

export default defineScreen<ThreadArgs>(thread, {
	mobile: () => import("./thread.mobile"),
	desktop: () => import("./thread.desktop"),
});
