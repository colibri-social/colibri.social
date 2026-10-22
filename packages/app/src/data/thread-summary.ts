import type { social } from "@colibri-social/lexicons";
import {
	type ChannelSummary,
	newerSummary,
	summarizeChannel,
} from "./channel-summary";
import type { ThreadView } from "./types";

type ServedSummary = social.colibri.beta.channel.defs.ChannelSummary;

const isServedSummary = (value: unknown): value is ServedSummary => {
	if (typeof value !== "object" || value === null) return false;
	const fields = value as Record<string, unknown>;
	return (
		typeof fields.channel === "string" &&
		typeof fields.rkey === "string" &&
		typeof fields.author === "string" &&
		typeof fields.text === "string" &&
		typeof fields.attachmentCount === "number" &&
		typeof fields.forward === "boolean" &&
		typeof fields.createdAt === "string" &&
		(fields.facets === undefined || Array.isArray(fields.facets)) &&
		(fields.attachmentKind === undefined ||
			typeof fields.attachmentKind === "string")
	);
};

export const servedThreadSummary = (
	thread: ThreadView,
): ChannelSummary | undefined => {
	const served = (thread as { lastMessage?: unknown }).lastMessage;
	return isServedSummary(served) ? summarizeChannel(served) : undefined;
};

export const threadSummary = (
	thread: ThreadView,
	live: ChannelSummary | undefined,
): ChannelSummary | undefined => {
	const served = servedThreadSummary(thread);
	if (!served) return live;
	if (!live) return served;
	return newerSummary(served, live) ? live : served;
};
