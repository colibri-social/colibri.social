import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	handle: string;
};

export const kickUser: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, community, identifier) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.kickUser",
		route: `/xrpc/social.colibri.community.kickUser?community=${encodeURIComponent(community)}&identifier=${encodeURIComponent(identifier)}`,
		init: { method: "POST" },
	});
};
