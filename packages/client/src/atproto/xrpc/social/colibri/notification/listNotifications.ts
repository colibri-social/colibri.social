import type { JsonBlobRef } from "@atproto/lexicon";
import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

type NotificationMessage = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
	createdAt: string;
	parent?: string;
	attachments: Array<JsonBlobRef>;
	edited?: boolean;
};

type Notification = {
	id: number;
	recipientDid: string;
	kind: string;
	messageUri: string;
	authorDid: string;
	channelUri: string;
	indexedAt: string;
	seenAt?: string;
	mentionRoleName?: string;
	message?: NotificationMessage;
};

type Response = {
	cursor?: string;
	notifications: Array<Notification>;
};

export const listNotifications: XrpcRequest<
	[number | undefined, string | undefined],
	Promise<XrpcResult<Response>>
> = async (fetch, limit, cursor) => {
	const params = new URLSearchParams();
	if (limit !== undefined) params.set("limit", String(limit));
	if (cursor !== undefined) params.set("cursor", cursor);
	const qs = params.toString();

	return request<Response>(fetch, {
		lxm: "social.colibri.notification.listNotifications",
		route: `/xrpc/social.colibri.notification.listNotifications${qs ? `?${qs}` : ""}`,
	});
};
