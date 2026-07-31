import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const reorderChannels: XrpcRequest<
	[string, string[]],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, category, channelOrder) => {
	const params = new URLSearchParams({ category });
	channelOrder.forEach((uri) => {
		params.append("channelOrder", uri);
	});

	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.community.reorderChannels",
		route: `/xrpc/social.colibri.community.reorderChannels?${params.toString()}`,
		init: { method: "POST" },
	});
};
