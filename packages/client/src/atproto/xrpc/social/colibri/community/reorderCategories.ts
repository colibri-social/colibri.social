import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const reorderCategories: XrpcRequest<
	[string, string[]],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, community, categoryOrder) => {
	const params = new URLSearchParams({ community });
	categoryOrder.forEach((uri) => {
		params.append("categoryOrder", uri);
	});

	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.community.reorderCategories",
		route: `/xrpc/social.colibri.community.reorderCategories?${params.toString()}`,
		init: { method: "POST" },
	});
};
