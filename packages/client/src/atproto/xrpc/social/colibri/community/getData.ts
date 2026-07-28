import type { JsonBlobRef } from "@atproto/lexicon";
import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";
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
	Promise<Community | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.getData?community=${community}`,
		);

		if (!res.ok) return undefined;

		return await readJson<Community>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
