import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	handle: string;
	didDoc: unknown;
};

export const resolveIdentity: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, identifier) => {
	return request<Response>(fetch, {
		lxm: "com.atproto.identity.resolveIdentity",
		route: `/xrpc/com.atproto.identity.resolveIdentity?identifier=${identifier}`,
	});
};
