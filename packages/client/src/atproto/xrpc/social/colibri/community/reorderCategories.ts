import type { XrpcRequest } from "../../..";
import { readJson } from "../../../read-json";

export const reorderCategories: XrpcRequest<
	[string, string[]],
	Promise<Record<string, never> | undefined>
> = async (fetch, community, categoryOrder) => {
	try {
		const params = new URLSearchParams({ community });
		categoryOrder.forEach((uri) => {
			params.append("categoryOrder", uri);
		});
		const res = await fetch(
			`/xrpc/social.colibri.community.reorderCategories?${params.toString()}`,
			{ method: "POST" },
		);
		if (!res.ok) return undefined;
		return await readJson<Record<string, never>>(res);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
