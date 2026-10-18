import type { Did, ThreadView } from "../types";

export const mockThreadRights = (
	view: Pick<ThreadView, "createdBy" | "locked">,
	viewer: Did,
	manages: boolean,
) => {
	const opener = view.createdBy === viewer;
	return {
		canPost: !view.locked || manages,
		canManage: manages,
		canEdit: manages || opener,
		canClose: manages || (opener && !view.locked),
		canDelete: manages || opener,
		canLock: manages,
	};
};
