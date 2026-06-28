import type { Community } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";

type Response = {
	communities: Array<Community>;
};

export const listCommunities: XrpcRequest<
	[],
	Promise<Response | undefined>
> = async (fetch) => {
	try {
		const listCommunitiesRes = await fetch(
			`/xrpc/social.colibri.actor.listCommunities`,
		);

		return listCommunitiesRes.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
