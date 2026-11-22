import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { spaceHostingMove } from "./hosting-move.contract";

export default defineScreen<AdminArgs>(spaceHostingMove, {
	mobile: () => import("./hosting-move.mobile"),
	desktop: () => import("./hosting-move.desktop"),
});
