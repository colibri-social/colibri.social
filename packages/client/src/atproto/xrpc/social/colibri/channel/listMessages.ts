import type { JsonBlobRef } from "@atproto/lexicon";
import type { ActorData, ColibriRichTextFacet } from "@colibri-social/lib";
import type { XrpcRequest } from "../../..";
import { request } from "../../../request";
import type { XrpcResult } from "../../../result";

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
		width?: number;
		height?: number;
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
	Promise<XrpcResult<Response>>
> = async (fetch, channel, limit, cursor, all) => {
	const params = new URLSearchParams({ channel });
	if (limit !== undefined) params.set("limit", String(limit));
	if (cursor !== undefined) params.set("cursor", cursor);
	if (all !== undefined) params.set("all", String(all));

	return request<Response>(fetch, {
		lxm: "social.colibri.channel.listMessages",
		route: `/xrpc/social.colibri.channel.listMessages?${params.toString()}`,
	});
};
