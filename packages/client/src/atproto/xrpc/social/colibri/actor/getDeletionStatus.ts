import type { JsonBlobRef } from "@atproto/lexicon";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type SoleOwnedCommunity = {
	uri: string;
	name: string;
	picture?: JsonBlobRef;
	memberCount: number;
};

export type DeletionCounts = {
	records: number;
	notifications: number;
	pushSubscriptions: number;
	invitations: number;
};

export type DeletionStatus = {
	soleOwnedCommunities: Array<SoleOwnedCommunity>;
	counts: DeletionCounts;
	pdsAccountPage?: string;
};

export const getDeletionStatus: XrpcRequest<
	[],
	Promise<XrpcResult<DeletionStatus>>
> = (fetch) =>
	request<DeletionStatus>(fetch, {
		lxm: "social.colibri.actor.getDeletionStatus",
		route: "/xrpc/social.colibri.actor.getDeletionStatus",
	});
