import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
import type { Invitation } from "./listInvitations";

export const createInvitation: XrpcRequest<
	[string],
	Promise<XrpcResult<Invitation>>
> = async (fetch, community) => {
	return request<Invitation>(fetch, {
		lxm: "social.colibri.community.createInvitation",
		route: `/xrpc/social.colibri.community.createInvitation?community=${community}`,
		init: {
			method: "POST",
		},
	});
};
