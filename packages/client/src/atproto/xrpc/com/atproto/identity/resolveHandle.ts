import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
};

export const resolveHandle: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, handle) => {
	return request<Response>(fetch, {
		lxm: "com.atproto.identity.resolveHandle",
		route: `/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`,
	});
};
