import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Reaction = {
	emoji: string;
	count: number;
	reactorDIDs: Array<string>;
};

type Response = {
	reactions: Array<Reaction>;
};

export const listReactions: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, message) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.channel.listReactions",
		route: `/xrpc/social.colibri.channel.listReactions?message=${encodeURIComponent(message)}`,
	});
};
