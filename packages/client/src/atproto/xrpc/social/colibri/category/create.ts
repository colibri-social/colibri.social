import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, community, name) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.category.create",
		route: `/xrpc/social.colibri.category.create?community=${encodeURIComponent(community)}&name=${encodeURIComponent(name)}`,
		init: { method: "POST" },
	});
};
