import type { JsonBlobRef } from "@atproto/lexicon";
import type { ActorData, ColibriRichTextFacet } from "lib";
import { XrpcRequest } from "../../..";

export type Reaction = {
	emoji: string;
	count: number;
	reactorDIDs: Array<string>;
};

export type Message = {
	uri: string;
	text: string;
	facets: Array<ColibriRichTextFacet>;
	channel: string;
	community: string;
	author: ActorData;
	parent?: Omit<Message, "parent">;
	attachments: Array<{
		name?: string;
		blob: JsonBlobRef;
	}>;
	reactions: Array<Reaction>;
	createdAt: string;
	edited: boolean;
};

/**
 * An optimistic message that has been sent to the PDS but not yet
 * confirmed (or rejected). `uri` is an empty string — `isPending()`
 * checks `uri.length === 0`. The `hash` field is a random identifier
 * used to match the pending row against the PDS confirmation.
 */
export type PendingMessage = Message & { hash: string };

export type Response = {
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
