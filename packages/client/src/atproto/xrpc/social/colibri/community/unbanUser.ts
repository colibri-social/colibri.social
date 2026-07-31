import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	handle: string;
};

export const unbanUser: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, community, identifier) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.unbanUser",
		route: `/xrpc/social.colibri.community.unbanUser?community=${community}&identifier=${identifier}`,
		init: {
			method: "POST",
		},
	});
};
