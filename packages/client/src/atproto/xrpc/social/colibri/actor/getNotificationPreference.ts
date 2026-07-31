import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type NotificationLevel = "all" | "mentionsAndReplies";

type Response = {
	level: NotificationLevel;
};

export const getNotificationPreference: XrpcRequest<
	[],
	Promise<XrpcResult<Response>>
> = async (fetch) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.actor.getNotificationPreference",
		route: `/xrpc/social.colibri.actor.getNotificationPreference`,
	});
};
