import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	code: string;
};

export const deleteInvitation: XrpcRequest<
	[string, string],
	Promise<XrpcResult<Response>>
> = async (fetch, uri, code) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.deleteInvitation",
		route: `/xrpc/social.colibri.community.deleteInvitation?uri=${uri}&code=${code}`,
		init: {
			method: "POST",
		},
	});
};
