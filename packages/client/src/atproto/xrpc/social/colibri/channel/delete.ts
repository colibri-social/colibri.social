import type { XrpcRequest } from "../../..";

const del: XrpcRequest<
	[string],
	Promise<Record<string, never> | undefined>
> = async (fetch, channel) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.delete?channel=${encodeURIComponent(channel)}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export { del as delete };
