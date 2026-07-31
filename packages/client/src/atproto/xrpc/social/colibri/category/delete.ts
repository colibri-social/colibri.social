import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

const del: XrpcRequest<
	[string],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, category) => {
	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.category.delete",
		route: `/xrpc/social.colibri.category.delete?category=${encodeURIComponent(category)}`,
		init: { method: "POST" },
	});
};

export { del as delete };
