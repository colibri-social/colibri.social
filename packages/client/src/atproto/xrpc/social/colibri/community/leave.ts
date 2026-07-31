import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const leave: XrpcRequest<
	[string],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, community) => {
	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.community.leave",
		route: `/xrpc/social.colibri.community.leave?community=${encodeURIComponent(community)}`,
		init: { method: "POST" },
	});
};
