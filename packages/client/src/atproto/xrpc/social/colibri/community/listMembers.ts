import type { JsonBlobRef } from "@atproto/lexicon";
import type { OnlineState, ProfileTheme } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type Member = {
	did: string;
	handle: string;
	roles: Array<string>;
	vc?: string;
	vcMuted?: boolean;
	vcDeafened?: boolean;
	vcServerMuted?: boolean;
	vcServerDeafened?: boolean;
	data: {
		displayName: string;
		avatar?: JsonBlobRef;
		banner?: JsonBlobRef;
		description?: string;
		isBot: boolean;
		onlineState: OnlineState;
		theme?: ProfileTheme;
		status?: {
			emoji?: string;
			text: string;
		};
	};
};

type Response = {
	members: Array<Member>;
};

export const listMembers: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listMembers",
		route: `/xrpc/social.colibri.community.listMembers?community=${community}`,
	});
};
