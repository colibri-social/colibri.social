import type { ColibriErrorCode } from "@colibri-social/lib";

export type CommunityViewerState = {
	isMember: boolean;
	isBanned?: boolean;
};

export const communityAccessCode = (
	viewer: CommunityViewerState,
): ColibriErrorCode | undefined => {
	if (viewer.isBanned) return "Banned";
	if (!viewer.isMember) return "NotAMember";
	return undefined;
};
