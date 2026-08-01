import type { Colibri_MessageEvent } from "@colibri-social/lib";
import type { Message } from "../xrpc/social/colibri/channel/listMessages";
import { cursorFor } from "./messages-snapshot";
import type { MessagesSnapshot } from "./schema";

let openChannel: string | undefined;

export const registerOpenChannel = (uri: string | undefined): void => {
	openChannel = uri || undefined;
};

export const isOpenChannel = (uri: string): boolean => openChannel === uri;

export const applyMessageEvent = (
	snapshot: MessagesSnapshot,
	event: NonNullable<Colibri_MessageEvent["data"]>,
	limit: number,
): MessagesSnapshot | undefined => {
	if (event.event === "delete") {
		const remaining = snapshot.messages.filter((m) => m.uri !== event.uri);
		if (remaining.length === snapshot.messages.length) return undefined;
		return {
			...snapshot,
			messages: remaining,
			cursor: cursorFor(remaining, snapshot.cursor),
			ts: Date.now(),
		};
	}

	const community = snapshot.messages[0]?.community;
	if (!community) return undefined;

	const existing = snapshot.messages.find((m) => m.uri === event.uri);

	const message: Message = {
		uri: event.uri,
		text: event.text,
		facets: event.facets,
		channel: event.channel,
		community,
		author: event.author,
		parent: existing?.parent,
		attachments: event.attachments,
		reactions: existing?.reactions ?? [],
		createdAt: event.createdAt,
		edited: event.edited,
	};

	const next = existing
		? snapshot.messages.map((m) => (m.uri === event.uri ? message : m))
		: [...snapshot.messages, message];
	const messages = next.slice(-limit);

	return {
		...snapshot,
		messages,
		cursor: cursorFor(messages, snapshot.cursor),
		hasMore: messages.length < next.length ? true : snapshot.hasMore,
		ts: Date.now(),
	};
};
