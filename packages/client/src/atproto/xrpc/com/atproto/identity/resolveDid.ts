import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

// Our appview and the PDS have a mismatch here, the AppView needs to be updated
type Response = {
	data?: {
		alsoKnownAs: Array<string>;
	};
	alsoKnownAs?: Array<string>;
};

export const resolveDid: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, did) => {
	return request<Response>(fetch, {
		lxm: "com.atproto.identity.resolveDid",
		route: `/xrpc/com.atproto.identity.resolveDid?did=${did}`,
	});
};
