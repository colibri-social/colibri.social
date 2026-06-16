import type { XrpcRequest } from "../../..";

export const editChannel: XrpcRequest<
	[string, string, string],
	Promise<Record<string, never> | undefined>
> = async (fetch, channel, name, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.update?channel=${encodeURIComponent(channel)}&name=${encodeURIComponent(name)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
