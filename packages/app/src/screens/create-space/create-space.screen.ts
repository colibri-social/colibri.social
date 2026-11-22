import { defineScreen } from "../../screen/define";
import { type CreateSpaceArgs, createSpace } from "./create-space.contract";

export default defineScreen<CreateSpaceArgs>(createSpace, {
	mobile: () => import("./create-space.mobile"),
	desktop: () => import("./create-space.desktop"),
});
