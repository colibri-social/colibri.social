import type { XrpcRequest } from "../../..";

type Response = {
	did: string;
	community: string;
	member?: string;
};

export const approveMembership: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, membership, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.approveMembership?membership=${encodeURIComponent(membership)}&auth=${auth}`,
			{ method: "POST" },
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
