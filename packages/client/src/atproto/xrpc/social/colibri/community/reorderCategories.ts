import type { XrpcRequest } from "../../..";

export const reorderCategories: XrpcRequest<
	[string, string[], string],
	Promise<Record<string, never> | undefined>
> = async (fetch, community, categoryOrder, auth) => {
	try {
		const params = new URLSearchParams({ community, auth });
		categoryOrder.forEach((uri) => {
			params.append("categoryOrder", uri);
		});
		const res = await fetch(
			`/xrpc/social.colibri.community.reorderCategories?${params.toString()}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
