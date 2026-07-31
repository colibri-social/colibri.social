import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type EmbedMetadata = {
	title?: string;
	description?: string;
	siteName?: string;
	themeColor?: string;
	image?: Array<{ url: string; alt?: string }>;
	/** Large (`summary_large_image`) vs small thumbnail (`summary`) layout. */
	largeImage?: boolean;
};

export const getMetadata: XrpcRequest<
	[string],
	Promise<XrpcResult<EmbedMetadata>>
> = async (fetch, uri) => {
	return request<EmbedMetadata>(fetch, {
		lxm: "social.colibri.embed.getMetadata",
		route: `/xrpc/social.colibri.embed.getMetadata?uri=${encodeURIComponent(uri)}`,
	});
};
