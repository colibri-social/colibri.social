import type { JsonBlobRef } from "@atproto/lexicon";
import type { AT_URI } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	code: string;
	community: AT_URI<"social.colibri.community">;
	createdBy: string;
	active: boolean;
	name: string;
	picture?: JsonBlobRef;
	banner?: JsonBlobRef;
	memberCount: number;
	onlineCount: number;
	requiresApprovalToJoin: boolean;
};

export const getInvitation: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, code) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.getInvitation",
		route: `/xrpc/social.colibri.community.getInvitation?code=${encodeURIComponent(code)}`,
	});
};
