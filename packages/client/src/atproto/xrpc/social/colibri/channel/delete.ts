import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

const del: XrpcRequest<
	[string],
	Promise<XrpcResult<Record<string, never>>>
> = async (fetch, channel) => {
	return request<Record<string, never>>(fetch, {
		lxm: "social.colibri.channel.delete",
		route: `/xrpc/social.colibri.channel.delete?channel=${encodeURIComponent(channel)}`,
		init: { method: "POST" },
	});
};

export { del as delete };
