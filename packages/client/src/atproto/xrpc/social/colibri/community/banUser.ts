import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	handle: string;
};

export const banUser: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, community, identifier) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.banUser",
		route: `/xrpc/social.colibri.community.banUser?community=${community}&identifier=${identifier}`,
		init: {
			method: "POST",
		},
	});
};
