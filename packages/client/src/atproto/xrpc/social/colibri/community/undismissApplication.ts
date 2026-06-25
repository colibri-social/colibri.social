import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	community: string;
};

export const undismissApplication: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, community, did, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.undismissApplication?community=${encodeURIComponent(community)}&did=${encodeURIComponent(did)}&auth=${auth}`,
			{ method: "POST" },
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
