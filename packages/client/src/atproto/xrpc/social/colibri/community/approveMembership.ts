import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	community: string;
	member?: string;
};

export const approveMembership: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, membership) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.approveMembership",
		route: `/xrpc/social.colibri.community.approveMembership?membership=${encodeURIComponent(membership)}`,
		init: { method: "POST" },
	});
};
