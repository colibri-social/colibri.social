import { defineScreen } from "../../screen/define";
import { type InboxArgs, inbox } from "./inbox.contract";

export default defineScreen<InboxArgs>(inbox, {
	mobile: () => import("./inbox.mobile"),
	desktop: () => import("./inbox.desktop"),
});
