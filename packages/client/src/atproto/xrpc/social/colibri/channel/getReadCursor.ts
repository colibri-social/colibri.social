import { XrpcRequest } from "../../..";

type Response = {
	uri: string;
	cursor: string;
	channel: string;
};

export const getReadCursor: XrpcRequest<
	[string, string],
	Promise<Response | undefined>
> = async (fetch, channel, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.getReadCursor?channel=${channel}&auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
