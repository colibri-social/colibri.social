import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	uri: string;
};

const del: XrpcRequest<[string], Promise<XrpcResult<Response>>> = async (
	fetch,
	role,
) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.role.delete",
		route: `/xrpc/social.colibri.role.delete?role=${encodeURIComponent(role)}`,
		init: { method: "POST" },
	});
};

export { del as delete };
