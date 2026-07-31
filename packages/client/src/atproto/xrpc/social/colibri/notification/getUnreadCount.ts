import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	count: number;
};

export const getUnreadCount: XrpcRequest<
	[],
	Promise<XrpcResult<Response>>
> = async (fetch) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.notification.getUnreadCount",
		route: `/xrpc/social.colibri.notification.getUnreadCount`,
	});
};
