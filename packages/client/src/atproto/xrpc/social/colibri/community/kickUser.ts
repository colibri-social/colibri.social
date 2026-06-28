import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	handle: string;
};

export const kickUser: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.kickUser?community=${encodeURIComponent(community)}&identifier=${encodeURIComponent(identifier)}`,
			{ method: "POST" },
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
