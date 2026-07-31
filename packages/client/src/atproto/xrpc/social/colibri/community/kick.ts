import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const kick: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, community, member) => {
	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.community.kick",
		route: `/xrpc/social.colibri.community.kick?community=${encodeURIComponent(community)}&member=${encodeURIComponent(member)}`,
		init: { method: "POST" },
	});
};
