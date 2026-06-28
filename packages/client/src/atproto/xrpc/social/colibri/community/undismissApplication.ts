import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	community: string;
};

export const undismissApplication: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, did) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.undismissApplication?community=${encodeURIComponent(community)}&did=${encodeURIComponent(did)}`,
			{ method: "POST" },
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
