import type { JsonBlobRef } from "@atproto/lexicon";
import type { ActorData, ColibriRichTextFacet } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";

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
 * An optimistic message queued in the offline outbox but not yet confirmed
 * by the AppView. `uri` is the deterministic `at://` URI assigned at send
 * time (from the client-generated rkey), so replies/reactions can reference
 * it while still queued. The presence of `hash` is what marks a row pending —
 * `isPending()` checks `"hash" in message` — and it's cleared once the
 * AppView echoes the message back over the socket.
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
