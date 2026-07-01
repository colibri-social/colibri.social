import type { ActorData, Community } from "@colibri-social/lib";
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
