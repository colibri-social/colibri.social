import type { ActorData } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export const getData: XrpcRequest<[string], Promise<XrpcResult<ActorData>>> = (
	fetch,
	identifier,
) =>
	request<ActorData>(fetch, {
		lxm: "social.colibri.actor.getData",
		route: `/xrpc/social.colibri.actor.getData?identifier=${identifier}`,
	});
