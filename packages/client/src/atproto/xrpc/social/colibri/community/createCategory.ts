import type { XrpcRequest } from "../../..";

type Response = {
	uri: string;
};

export const createCategory: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, community, name, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.createCategory?community=${encodeURIComponent(community)}&name=${encodeURIComponent(name)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
