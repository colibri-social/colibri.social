import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	updated: number;
	clearedPings: number;
};

export const updateSeenForMessage: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, message) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.notification.updateSeenForMessage",
		route: `/xrpc/social.colibri.notification.updateSeenForMessage?message=${message}`,
		init: {
			method: "POST",
		},
	});
};
