import type { JsonBlobRef } from "@atproto/lexicon";
import type { ColibriRichTextFacet } from "lib";
import { XrpcRequest } from "../../..";

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
	channelRkey: string;
	indexedAt: string;
	seenAt?: string;
	message?: NotificationMessage;
};

type Response = {
	cursor?: string;
	notifications: Array<Notification>;
};

export const listNotifications: XrpcRequest<
	[number | undefined, string | undefined, string],
	Promise<Response | undefined>
> = async (fetch, limit, cursor, auth) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.notification.listNotifications?limit=${limit}&cursor=${cursor}&auth=${auth}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
