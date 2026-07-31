import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
import type { GifPage } from "./gifTypes";

export const searchGifs: XrpcRequest<
	[string, number?],
	Promise<XrpcResult<GifPage>>
> = async (fetch, query, page) => {
	const params = new URLSearchParams({ q: query });
	if (page !== undefined) params.set("page", String(page));

	return request<GifPage>(fetch, {
		lxm: "social.colibri.embed.searchGifs",
		route: `/xrpc/social.colibri.embed.searchGifs?${params.toString()}`,
	});
};
