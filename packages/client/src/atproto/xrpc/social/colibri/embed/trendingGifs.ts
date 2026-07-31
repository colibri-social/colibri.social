import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
import type { GifPage } from "./gifTypes";

export const trendingGifs: XrpcRequest<
	[number?],
	Promise<XrpcResult<GifPage>>
> = async (fetch, page) => {
	const params = new URLSearchParams();
	if (page !== undefined) params.set("page", String(page));
	const qs = params.toString();

	return request<GifPage>(fetch, {
		lxm: "social.colibri.embed.trendingGifs",
		route: `/xrpc/social.colibri.embed.trendingGifs${qs ? `?${qs}` : ""}`,
	});
};
