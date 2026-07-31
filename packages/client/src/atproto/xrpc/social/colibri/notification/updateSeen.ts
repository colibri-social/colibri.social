import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	updated: number;
};

export const updateSeen: XrpcRequest<
	[string | undefined],
	Promise<XrpcResult<Response>>
> = async (fetch, seenAt) => {
	const params = new URLSearchParams();
	if (seenAt !== undefined) params.set("seenAt", seenAt);
	const qs = params.toString();

	return request<Response>(fetch, {
		lxm: "social.colibri.notification.updateSeen",
		route: `/xrpc/social.colibri.notification.updateSeen${qs ? `?${qs}` : ""}`,
		init: {
			method: "POST",
		},
	});
};
