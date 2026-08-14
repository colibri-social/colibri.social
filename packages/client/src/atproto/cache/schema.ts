import type { AppBskyFeedDefs } from "@atproto/api";
import type { ActorData, Community } from "@colibri-social/lib";
import type { Message } from "../xrpc/social/colibri/channel/listMessages";
import type { Community as CommunityDetail } from "../xrpc/social/colibri/community/getData";

export const SCHEMA_VERSION = 3;

export type UserSnapshot = {
	actorData: ActorData;
	communities: Community[];
};

export type CommunitySnapshot = CommunityDetail;

export type MessagesSnapshot = {
	messages: Message[];
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
