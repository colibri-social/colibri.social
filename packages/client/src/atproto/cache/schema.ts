import type { AppBskyFeedDefs } from "@atproto/api";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	MemberView,
	MessageView,
	ProfileView,
	RoleView,
	ThreadView,
} from "../views";

export const SCHEMA_VERSION = 6;

export type UserSnapshot = {
	profile: ProfileView;
	communities: CommunityView[];
};

export type CommunitySnapshot = {
	community: CommunityView;
	categories: CategoryView[];
	channels: ChannelView[];
	roles: RoleView[];
	members: MemberView[];
	ts: number;
};

export type ThreadsSnapshot = {
	threads: ThreadView[];
	ts: number;
};

export type PendingMessage = Pick<
	MessageView,
	| "uri"
	| "channel"
	| "author"
	| "text"
	| "facets"
	| "createdAt"
	| "attachments"
	| "parent"
	| "forward"
> & {
	hash: string;
	failed?: boolean;
};

export type MessagesSnapshot = {
	space: string;
	messages: MessageView[];
	readCursor?: string;
	cursor?: string;
	hasMore?: boolean;
	ts: number;
};

/**
 * Bluesky embed data is public and identical for every viewer
 */
export type BskyPostSnapshot = { post: AppBskyFeedDefs.PostView; ts: number };

export type BskyHandleSnapshot = { did: string; ts: number };

export type BskyMuVerificationSnapshot = {
	result: {
		issuerDid: string;
		issuerHandle: string;
		issuerDisplayName?: string;
	} | null;
	ts: number;
};

export type BskyMuTrustedListSnapshot = {
	profiles: Map<string, { handle: string; displayName?: string }>;
	ts: number;
};

export type LabelerLabel = { val: string; neg: boolean; exp?: string };

export type LabelerLabelsSnapshot = { labels: Array<LabelerLabel>; ts: number };

export type BadgeAppearance = {
	variant: "solid" | "gradientBorder";
	colors: Array<string>;
	foreground: string;
};

export type BadgeDefinition = {
	identifier: string;
	name: string;
	description: string;
	precedence?: number;
	appearance?: BadgeAppearance;
};

export type LabelerBadgeDefinitionsSnapshot = {
	definitions: Array<BadgeDefinition>;
	ts: number;
};

export type ExternalAccountLink = {
	platform: string;
	accountId: string;
	accountSlug?: string;
	verifiedAt: string;
};

export type ExternalAccountLinkSnapshot = {
	link: ExternalAccountLink | null;
	ts: number;
};
