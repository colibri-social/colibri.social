import type { XrpcRequest } from "../../..";

export const updateCategory: XrpcRequest<
	[string, string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, category, name, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.category.update?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
