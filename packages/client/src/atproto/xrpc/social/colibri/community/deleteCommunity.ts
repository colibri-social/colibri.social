import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
};

export const deleteCommunity: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.delete?community=${encodeURIComponent(community)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
