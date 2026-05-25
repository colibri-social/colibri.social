import type { JsonBlobRef } from "@atproto/lexicon";
import { XrpcRequest } from "../../..";
import type { Category } from "./listCategories";
import type { Channel } from "./listChannels";
import type { Member } from "./listMembers";
import type { Role } from "./listRoles";

export type CommunityData = {
	uri: string;
	name: string;
	description: string;
	picture?: JsonBlobRef;
	categoryOrder: Array<string>;
	requiresApprovalToJoin: boolean;
};

export type Response = {
	community: CommunityData;
	categories: Array<Category>;
	channels: Array<Channel>;
	roles: Array<Role>;
	members: Array<Member>;
};

export const getData: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.getData?community=${community}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
