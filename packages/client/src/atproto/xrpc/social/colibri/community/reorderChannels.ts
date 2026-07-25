import type { XrpcRequest } from "../../..";

export const reorderChannels: XrpcRequest<
	[string, string[]],
	Promise<Record<string, never> | undefined>
> = async (fetch, category, channelOrder) => {
	try {
		const params = new URLSearchParams({ category });
		channelOrder.forEach((uri) => {
			params.append("channelOrder", uri);
		});
		const res = await fetch(
			`/xrpc/social.colibri.community.reorderChannels?${params.toString()}`,
			{ method: "POST" },
		);
		if (!res.ok) return undefined;
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
