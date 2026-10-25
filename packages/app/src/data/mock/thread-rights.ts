import type { Did, ThreadView } from "../types";

export const mockThreadRights = (
	view: Pick<ThreadView, "createdBy" | "locked">,
	viewer: Did,
	manages: boolean,
	channelCanPost: boolean,
) => {
	const opener = view.createdBy === viewer;
	return {
		canPost: channelCanPost && (!view.locked || manages),
		canManage: manages,
		canEdit: manages || opener,
		canClose: manages || (opener && !view.locked),
		canDelete: manages || opener,
		canLock: manages,
	};
};
