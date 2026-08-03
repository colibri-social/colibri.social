import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

export type UnseenNotification = {
	id: number;
	kind: "mention" | "reply" | "message";
	messageUri: string;
	indexedAt: string;
};

export const isPingKind = (kind: string): boolean =>
	kind === "mention" || kind === "reply";

type Response = {
	notifications: UnseenNotification[];
};

export const getUnseen: XrpcRequest<
	[string],
	Promise<XrpcResult<Response>>
> = async (fetch, channel) => {
	return request<Response>(fetch, {
		lxm: "social.colibri.notification.getUnseen",
		route: `/xrpc/social.colibri.notification.getUnseen?channel=${channel}`,
	});
};
