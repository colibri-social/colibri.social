import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
};

const del: XrpcRequest<
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

export { del as delete };
