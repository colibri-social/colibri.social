import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type RoleChannelOverride = {
	channel: string;
	allow: Array<string>;
	deny: Array<string>;
};

export type Role = {
	uri: string;
	name: string;
	color?: string;
	permissions: Array<string>;
	position: number;
	hoisted?: boolean;
	mentionable?: boolean;
	protected?: boolean;
	channelOverrides: Array<RoleChannelOverride>;
};

type Response = {
	roles: Array<Role>;
};

export const listRoles: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listRoles",
		route: `/xrpc/social.colibri.community.listRoles?community=${community}`,
	});
};
