import { defineScreen } from "../../screen/define";
import { type ThreadDraftArgs, threadDraft } from "./thread-draft.contract";

export default defineScreen<ThreadDraftArgs>(threadDraft, {
	mobile: () => import("./thread-draft.mobile"),
	desktop: () => import("./thread-draft.desktop"),
});
