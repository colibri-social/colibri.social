import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const setMemberRoles: XrpcRequest<
	[string, string, string[]],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, community, member, roles) => {
	const params = new URLSearchParams({
		community,
		member,
	});
	roles.forEach((uri) => {
		params.append("roles", uri);
	});

	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.community.setMemberRoles",
		route: `/xrpc/social.colibri.community.setMemberRoles?${params.toString()}`,
		init: { method: "POST" },
	});
};
