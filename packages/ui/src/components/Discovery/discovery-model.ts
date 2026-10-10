import type { SpaceJoinMode } from "../Invite/invite-settings";
import { formatMemberCount } from "../Space/SpaceMeta";

export type DiscoveryPlatform = "desktop" | "mobile";

export type DiscoveryViewerState = "none" | "pending" | "member";

export type DiscoverySpace = {
	id: string;
	name: string;
	handle?: string;
	iconSrc?: string;
	bannerSrc?: string;
	bannerColor?: string;
	description?: string;
	memberCount: number;
	onlineCount?: number;
	ownerHandle?: string;
	joinMode: SpaceJoinMode;
	viewer: DiscoveryViewerState;
};

export type DiscoveryActions = {
	onJoin?: (spaceId: string) => void;
	onRequestJoin?: (spaceId: string) => void;
	onOpenSpace?: (spaceId: string) => void;
};

const countFormat = new Intl.NumberFormat("en");

export const formatOnlineCount = (count: number) =>
	`${countFormat.format(count)} online`;

export const memberSummary = (space: DiscoverySpace) =>
	space.onlineCount
		? `${formatMemberCount(space.memberCount)} · ${formatOnlineCount(space.onlineCount)}`
		: formatMemberCount(space.memberCount);

export const matchesDiscoveryQuery = (space: DiscoverySpace, query: string) => {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return (
		space.name.toLowerCase().includes(needle) ||
		(space.description ?? "").toLowerCase().includes(needle)
	);
};

export const joinNote = (space: DiscoverySpace) => {
	if (space.viewer === "pending")
		return "A moderator reviews your request before you can open the Space.";
	if (space.viewer === "none" && space.joinMode === "approval")
		return "Requires approval to join";
	return undefined;
};

export const dispatchJoinAction = (
	space: DiscoverySpace,
	actions: DiscoveryActions,
) => {
	if (space.viewer === "member") actions.onOpenSpace?.(space.id);
	else if (space.viewer === "pending") return;
	else if (space.joinMode === "approval") actions.onRequestJoin?.(space.id);
	else actions.onJoin?.(space.id);
};
