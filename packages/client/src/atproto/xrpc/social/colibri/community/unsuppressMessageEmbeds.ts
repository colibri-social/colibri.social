import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	message: string;
};

export const unsuppressMessageEmbeds: XrpcRequest<
	[string, string, string[]],
	Promise<XrpcResult<Response>>
> = async (fetch, community, message, embeds) => {
	const params = new URLSearchParams({ community, message });
	for (const embed of embeds) params.append("embeds", embed);

	return request<Response>(fetch, {
		lxm: "social.colibri.community.unsuppressMessageEmbeds",
		route: `/xrpc/social.colibri.community.unsuppressMessageEmbeds?${params.toString()}`,
		init: {
			method: "POST",
		},
	});
};
