import type { JsonBlobRef } from "@atproto/lexicon";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
import type { Category } from "./listCategories";
import type { Channel } from "./listChannels";
import type { Member } from "./listMembers";
import type { Role } from "./listRoles";

export type CommunityData = {
	uri: string;
	name: string;
	description: string;
	picture?: JsonBlobRef;
	banner?: JsonBlobRef;
	categoryOrder: Array<string>;
	requiresApprovalToJoin: boolean;
	appview: string;
};

export type Community = {
	community: CommunityData;
	categories: Array<Category>;
	channels: Array<Channel>;
	roles: Array<Role>;
	members: Array<Member>;
	did: string;
};

export const getData: XrpcRequest<
	[string],
	Promise<XrpcResult<Community>>
> = async (fetch, community) => {
	return request<Community>(fetch, {
		lxm: "social.colibri.community.getData",
		route: `/xrpc/social.colibri.community.getData?community=${community}`,
	});
};
