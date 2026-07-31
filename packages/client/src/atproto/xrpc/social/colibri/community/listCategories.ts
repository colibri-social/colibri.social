import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type Category = {
	uri: string;
	name: string;
	channelOrder: Array<string>;
};

type Response = {
	categories: Array<Category>;
};

export const listCategories: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, community) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.community.listCategories",
		route: `/xrpc/social.colibri.community.listCategories?community=${community}`,
	});
};
