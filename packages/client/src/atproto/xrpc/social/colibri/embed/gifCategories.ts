import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";
import type { GifCategory } from "./gifTypes";

export const gifCategories: XrpcRequest<
	[],
	Promise<XrpcResult<Array<GifCategory>>>
> = async (fetch) => {
	const res = await request<{ categories?: Array<GifCategory> }>(fetch, {
		lxm: "social.colibri.embed.gifCategories",
		route: "/xrpc/social.colibri.embed.gifCategories",
	});

	if (!res.ok) return res;
	return { ok: true, data: res.data?.categories ?? [] };
};
