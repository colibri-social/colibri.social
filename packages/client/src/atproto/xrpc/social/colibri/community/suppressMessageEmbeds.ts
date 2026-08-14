import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	message: string;
};

export const suppressMessageEmbeds: XrpcRequest<
	[string, string, string[]],
	Promise<XrpcResult<Response>>
> = async (fetch, community, message, embeds) => {
	const params = new URLSearchParams({ community, message });
	for (const embed of embeds) params.append("embeds", embed);

	return request<Response>(fetch, {
		lxm: "social.colibri.community.suppressMessageEmbeds",
		route: `/xrpc/social.colibri.community.suppressMessageEmbeds?${params.toString()}`,
		init: {
			method: "POST",
		},
	});
};
