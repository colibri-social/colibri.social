import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	onlineState: string;
};

export const setState: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, state) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.actor.setState",
		route: `/xrpc/social.colibri.actor.setState?state=${state}`,
		init: {
			method: "POST",
		},
	});
};
