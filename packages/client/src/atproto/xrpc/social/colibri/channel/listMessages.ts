import type { JsonBlobRef } from "@atproto/lexicon";
import type { ColibriRichTextFacet } from "lib";
import { XrpcRequest } from "../../..";

type Reaction = {
	emoji: string;
	count: number;
	reactorDIDs: Array<string>;
};

type Message = {
	uri: string;
	text: string;
	facets: Array<ColibriRichTextFacet>;
	channel: string;
	community: string;
	author: string;
	parent: string;
	attachments: Array<JsonBlobRef>;
	reactions: Array<Reaction>;
};

type Response = {
	messages: Array<Message>;
};

export const listMessages: XrpcRequest<
	[string, number | undefined, string | undefined, boolean | undefined],
	Promise<Response | undefined>
> = async (fetch, channel, limit, cursor, all) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.channel.listMessages?channel=${channel}&limit=${limit}&cursor=${cursor}&all=${all}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
