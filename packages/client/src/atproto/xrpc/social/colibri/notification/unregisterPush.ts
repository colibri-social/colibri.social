import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	unregistered: boolean;
};

export const unregisterPush: XrpcRequest<
	[string, string?],
	Promise<XrpcResult<Response>>
> = async (fetch, endpoint, provider) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.notification.unregisterPush",
		route: `/xrpc/social.colibri.notification.unregisterPush`,
		init: {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(provider ? { endpoint, provider } : { endpoint }),
		},
	});
};
