import type { ActorData, Community } from "lib";
import { XrpcRequest } from "../../..";

type Response = {
	communities: Array<Community>;
};

export const listCommunities: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, auth) => {
	try {
		const listCommunitiesRes = await fetch(
			`/xrpc/social.colibri.actor.listCommunities?auth=${auth}`,
		);

		return listCommunitiesRes.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
