import { defineScreen } from "../../screen/define";
import { type LegacySpaceArgs, legacySpace } from "./legacy-space.contract";

export default defineScreen<LegacySpaceArgs>(legacySpace, {
	mobile: () => import("./legacy-space.mobile"),
	desktop: () => import("./legacy-space.desktop"),
});
