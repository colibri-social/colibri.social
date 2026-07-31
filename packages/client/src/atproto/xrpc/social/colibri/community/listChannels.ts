import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type Channel = {
	uri: string;
	name: string;
	description?: string;
	type: string;
	category: string;
	ownerOnly?: boolean;
	allowedRoles?: string[];
	allowedMembers?: string[];
};

type Response = {
	channels: Array<Channel>;
};

export const listChannels: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listChannels",
		route: `/xrpc/social.colibri.community.listChannels?community=${community}`,
	});
};
