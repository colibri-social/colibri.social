import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	did: string;
	community: string;
};

export const undismissApplication: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, community, did) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.undismissApplication",
		route: `/xrpc/social.colibri.community.undismissApplication?community=${encodeURIComponent(community)}&did=${encodeURIComponent(did)}`,
		init: { method: "POST" },
	});
};
