import type { XrpcRequest } from "../../..";

type Response = {
	uri: string;
	cursor: string;
	channel: string;
};

export const getReadCursor: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, channel) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.getReadCursor?channel=${channel}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
