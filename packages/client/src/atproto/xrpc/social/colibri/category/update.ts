import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const update: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, category, name) => {
	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.category.update",
		route: `/xrpc/social.colibri.category.update?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}`,
		init: { method: "POST" },
	});
};
