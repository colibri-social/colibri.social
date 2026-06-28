import type { XrpcRequest } from "../../..";

type Response = {
	uri: string;
};

export const create: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, name) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.category.create?community=${encodeURIComponent(community)}&name=${encodeURIComponent(name)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
