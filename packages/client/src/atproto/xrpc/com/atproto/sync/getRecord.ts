import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
	value: Record<string, unknown>;
};

export const getRecord: XrpcRequest<
	[string, string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, repo, collection, rkey) => {
	return request<Response>(fetch, {
		lxm: "com.atproto.sync.getRecord",
		route: `/xrpc/com.atproto.sync.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`,
	});
};
