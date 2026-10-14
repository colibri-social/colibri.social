import { defineScreen } from "../../screen/define";
import { type DiscoverArgs, discover } from "./discover.contract";

export default defineScreen<DiscoverArgs>(discover, {
	mobile: () => import("./discover.mobile"),
	desktop: () => import("./discover.desktop"),
});
