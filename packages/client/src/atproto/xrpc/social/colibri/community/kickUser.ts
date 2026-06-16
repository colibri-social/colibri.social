import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	handle: string;
};

export const kickUser: XrpcRequest<
	[string, string, string],
	Promise<Response | undefined>
> = async (fetch, community, identifier, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.kickUser?community=${encodeURIComponent(community)}&identifier=${encodeURIComponent(identifier)}&auth=${auth}`,
			{ method: "POST" },
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
