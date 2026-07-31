import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type Mute = {
	uri: string;
	subject: string;
};

type Response = {
	mutes: Mute[];
};

export const listMutes: XrpcRequest<[], Promise<XrpcResult<Response>>> = async (
	fetch,
) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.actor.listMutes",
		route: `/xrpc/social.colibri.actor.listMutes`,
	});
};
