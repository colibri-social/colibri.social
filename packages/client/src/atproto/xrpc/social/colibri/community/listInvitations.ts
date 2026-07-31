import type { ActorData } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type Invitation = {
	code: string;
	community: string;
	createdBy: ActorData;
	active: boolean;
};

type Response = {
	codes: Array<Invitation>;
};

export const listInvitations: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, uri) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listInvitations",
		route: `/xrpc/social.colibri.community.listInvitations?uri=${uri}`,
		init: {
			method: "POST",
		},
	});
};
