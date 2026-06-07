import type { XrpcRequest } from "../../..";

type Response = {
	token: string;
	url: string;
};

export const getVoiceToken: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, channel, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.getVoiceToken?channel=${encodeURIComponent(channel)}&auth=${auth}`,
			{ method: "POST" },
		);
		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
