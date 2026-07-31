import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
};

const del: XrpcRequest<[string], Promise<XrpcResult<Response>>> = async (
	fetch,
	community,
) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.delete",
		route: `/xrpc/social.colibri.community.delete?community=${encodeURIComponent(community)}`,
		init: { method: "POST" },
	});
};

export { del as delete };
