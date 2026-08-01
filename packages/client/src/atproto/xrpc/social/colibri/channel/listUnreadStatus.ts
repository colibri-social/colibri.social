import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type ChannelUnreadStatus = {
	channelUri: string;
	hasUnreadMessages: boolean;
	unreadPingCount: number;
};

type Response = {
	channels: ChannelUnreadStatus[];
};

export const listUnreadStatus: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.channel.listUnreadStatus",
		route: `/xrpc/social.colibri.channel.listUnreadStatus?community=${community}`,
		expected: ["Forbidden"],
	});
};
