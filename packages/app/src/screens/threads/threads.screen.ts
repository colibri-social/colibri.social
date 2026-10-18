import { defineScreen } from "../../screen/define";
import { type ThreadsArgs, threads } from "./threads.contract";

export default defineScreen<ThreadsArgs>(threads, {
	mobile: () => import("./threads.mobile"),
	desktop: () => import("./threads.desktop"),
});
