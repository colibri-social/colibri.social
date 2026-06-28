import type { XrpcRequest } from "../../..";

export const leave: XrpcRequest<
	[string],
	Promise<Record<string, never> | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.leave?community=${encodeURIComponent(community)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
