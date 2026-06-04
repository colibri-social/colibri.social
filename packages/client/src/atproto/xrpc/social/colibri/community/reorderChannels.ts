import { XrpcRequest } from "../../..";

export const reorderChannels: XrpcRequest<
	[string, string[], string],
	Promise<Record<string, never> | undefined>
> = async (fetch, category, channelOrder, auth) => {
	try {
		const params = new URLSearchParams({ category, auth });
		channelOrder.forEach((uri) => params.append("channelOrder", uri));
		const res = await fetch(
			`/xrpc/social.colibri.community.reorderChannels?${params.toString()}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
