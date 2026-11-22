import type { DiscoverySpace } from "../Discovery/discovery-model";
import { formatMemberCount } from "../Space/SpaceMeta";

export type SpaceInviteCardProblem =
	| "invalid"
	| "expired"
	| "used-up"
	| "banned";

export type SpaceInviteCardState =
	| "loading"
	| "ready"
	| "failed"
	| SpaceInviteCardProblem;

export type SpaceInviteCardSpace = DiscoverySpace & { onlineCount?: number };

export const SPACE_INVITE_CARD_COPY = {
	eyebrow: "Space invite",
	loading: "Loading invite",
	invalid: {
		title: "This invite link isn't valid",
		description: "It may have been deleted, or the link is mistyped.",
	},
	expired: {
		title: "This invite link has expired",
		description: "Ask someone in the Space for a new link.",
	},
	"used-up": {
		title: "This invite link was used up",
		description: "Ask someone in the Space for a new link.",
	},
	banned: {
		title: "You can't join this Space",
		description: "You were banned from it.",
	},
	failed: {
		title: "This invite couldn't be loaded",
		description: "Check your connection and try again.",
	},
	retry: "Try again",
} as const;

const onlineFormat = new Intl.NumberFormat("en");

export const spaceInviteCardMeta = (space: SpaceInviteCardSpace) => {
	const members = formatMemberCount(space.memberCount);
	if (space.onlineCount === undefined) return { members };
	return {
		members,
		online: `${onlineFormat.format(space.onlineCount)} online`,
	};
};

export const isSpaceInviteCardProblem = (
	state: SpaceInviteCardState,
): state is SpaceInviteCardProblem =>
	state === "invalid" ||
	state === "expired" ||
	state === "used-up" ||
	state === "banned";
