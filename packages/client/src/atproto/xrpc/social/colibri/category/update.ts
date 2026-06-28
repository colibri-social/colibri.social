import type { XrpcRequest } from "../../..";

export const update: XrpcRequest<
	[string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, category, name) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.category.update?category=${encodeURIComponent(category)}&name=${encodeURIComponent(name)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
