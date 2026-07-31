import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
import type { Member } from "./listMembers";

type Response = {
	users: Array<Omit<Member, "roles">>;
};

export const listBannedUsers: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listBannedUsers",
		route: `/xrpc/social.colibri.community.listBannedUsers?community=${community}`,
	});
};
