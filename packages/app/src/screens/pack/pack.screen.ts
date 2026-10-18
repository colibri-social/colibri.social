import { defineScreen } from "../../screen/define";
import { type PackArgs, pack } from "./pack.contract";

export default defineScreen<PackArgs>(pack, {
	mobile: () => import("./pack.mobile"),
	desktop: () => import("./pack.desktop"),
});
