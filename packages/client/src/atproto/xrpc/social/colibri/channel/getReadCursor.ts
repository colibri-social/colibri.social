import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
	cursor: string;
	channel: string;
};

export const getReadCursor: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, channel) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.channel.getReadCursor",
		route: `/xrpc/social.colibri.channel.getReadCursor?channel=${channel}`,
	});
};
