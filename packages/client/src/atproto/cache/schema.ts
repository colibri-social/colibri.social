import type { ActorData, Community } from "@colibri-social/lib";
import type { AppBskyFeedDefs } from "@atproto/api";
import type { Message } from "../xrpc/social/colibri/channel/listMessages";
import type { Community as CommunityDetail } from "../xrpc/social/colibri/community/getData";

export const SCHEMA_VERSION = 1;

export type UserSnapshot = {
	actorData: ActorData;
	communities: Community[];
};

export type CommunitySnapshot = CommunityDetail;

export type MessagesSnapshot = {
	messages: Message[];
	readCursor?: string;
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
