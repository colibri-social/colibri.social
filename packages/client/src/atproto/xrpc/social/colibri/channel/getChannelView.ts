import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
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
	[string, number | undefined, AbortSignal?],
	Promise<XrpcResult<Response>>
> = async (fetch, channel, limit, signal) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.channel.getChannelView",
		route: `/xrpc/social.colibri.channel.getChannelView?channel=${channel}${
			limit !== undefined ? `&limit=${limit}` : ""
		}`,
		init: signal ? { signal } : undefined,
		expected: ["Timeout", "NetworkFailed", "Unreachable"],
	});
};
