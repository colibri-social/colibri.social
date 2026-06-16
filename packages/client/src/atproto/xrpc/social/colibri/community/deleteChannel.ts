import type { XrpcRequest } from "../../..";

export const deleteChannel: XrpcRequest<
	[string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, channel, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.delete?channel=${encodeURIComponent(channel)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
