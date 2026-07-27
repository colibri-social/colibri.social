import type { JsonBlobRef } from "@atproto/lexicon";
import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";

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
	Promise<Response | undefined>
> = async (fetch, limit, cursor) => {
	try {
		const params = new URLSearchParams();
		if (limit !== undefined) params.set("limit", String(limit));
		if (cursor !== undefined) params.set("cursor", cursor);
		const qs = params.toString();

		const res = await fetch(
			`/xrpc/social.colibri.notification.listNotifications${qs ? `?${qs}` : ""}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
