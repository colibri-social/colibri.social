import { defineScreen } from "../../screen/define";
import type { SpacesArgs } from "./spaces.contract";
import { spaces } from "./spaces.contract";

export default defineScreen<SpacesArgs>(spaces, {
	mobile: () => import("./spaces.mobile"),
	desktop: () => import("./spaces.desktop"),
});
