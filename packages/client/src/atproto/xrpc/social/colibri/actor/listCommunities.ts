import type { Community } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type Response = {
	communities: Array<Community>;
};

export const listCommunities: XrpcRequest<[], Promise<XrpcResult<Response>>> = (
	fetch,
) =>
	request<Response>(fetch, {
		lxm: "social.colibri.actor.listCommunities",
		route: "/xrpc/social.colibri.actor.listCommunities",
		expected: ["Timeout", "NetworkFailed", "Unreachable"],
	});
