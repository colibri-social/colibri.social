import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	message: string;
};

export const blockMessage: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, community, message) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.blockMessage",
		route: `/xrpc/social.colibri.community.blockMessage?community=${community}&message=${message}`,
		init: {
			method: "POST",
		},
	});
};
