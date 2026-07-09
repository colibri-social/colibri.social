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
		const res = await fetch(
			`/xrpc/social.colibri.notification.listNotifications?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
