import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	source: string;
};

export const registerCredentials: XrpcRequest<
	[string, string, string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, did, pds, identifier, password) => {
	const params = new URLSearchParams({ did, pds, identifier, password });

	return request<Response>(fetch, {
		lxm: "social.colibri.community.registerCredentials",
		route: `/xrpc/social.colibri.community.registerCredentials?${params.toString()}`,
		init: {
			method: "POST",
		},
	});
};
