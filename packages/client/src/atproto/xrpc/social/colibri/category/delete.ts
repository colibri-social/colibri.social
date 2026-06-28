import type { XrpcRequest } from "../../..";

const del: XrpcRequest<
	[string],
	Promise<Record<string, never> | undefined>
> = async (fetch, category) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.category.delete?category=${encodeURIComponent(category)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
