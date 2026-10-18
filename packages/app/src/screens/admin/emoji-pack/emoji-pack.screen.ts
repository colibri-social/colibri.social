import { defineScreen } from "../../../screen/define";
import type { AdminArgs } from "../../../shell/registry";
import { adminEmojiPack } from "./emoji-pack.contract";

export default defineScreen<AdminArgs>(adminEmojiPack, {
	mobile: () => import("./emoji-pack.mobile"),
	desktop: () => import("./emoji-pack.desktop"),
});
