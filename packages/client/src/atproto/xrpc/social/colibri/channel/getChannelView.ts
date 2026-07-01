import type { XrpcRequest } from "../../..";
import type { UnseenNotification } from "../notification/getUnseen";
import type { Message } from "./listMessages";

export type ReadCursor = {
	uri: string;
	cursor: string;
	channel: string;
};

export type Response = {
	cursor?: string;
	messages: Array<Message>;
	readCursor?: ReadCursor;
	unseen: Array<UnseenNotification>;
};

export const getChannelView: XrpcRequest<
	[string, number | undefined],
	Promise<Response | undefined>
> = async (fetch, channel, limit) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.getChannelView?channel=${channel}${
				limit !== undefined ? `&limit=${limit}` : ""
			}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
