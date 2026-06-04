import { XrpcRequest } from "../../..";

export const deleteCategory: XrpcRequest<
	[string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, category, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.deleteCategory?category=${encodeURIComponent(category)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
