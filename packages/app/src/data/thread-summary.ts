import type { social } from "@colibri-social/lexicons";
import { isFutureDated } from "@colibri-social/lib";
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
	if (!isServedSummary(served)) return undefined;
	const summary = summarizeChannel(served);
	return isFutureDated(summary) ? undefined : summary;
};

const isFutureActivity = (at: string, now: number) =>
	isFutureDated({ createdAt: at }, now);

export const withoutFutureActivity = (
	thread: ThreadView,
	previous?: ThreadView,
	now: number = Date.now(),
): ThreadView => {
	const futureActivity = isFutureActivity(thread.lastActivityAt, now);
	const futureMessage =
		!!thread.lastMessage && isFutureDated(thread.lastMessage, now);
	if (!futureActivity && !futureMessage) return thread;
	const next: ThreadView = { ...thread };
	if (futureActivity) {
		next.lastActivityAt =
			previous && !isFutureActivity(previous.lastActivityAt, now)
				? previous.lastActivityAt
				: isFutureActivity(thread.createdAt, now)
					? (new Date(now).toISOString() as ThreadView["lastActivityAt"])
					: thread.createdAt;
	}
	if (futureMessage) {
		const kept =
			previous?.lastMessage && !isFutureDated(previous.lastMessage, now)
				? previous.lastMessage
				: undefined;
		if (kept) next.lastMessage = kept;
		else delete next.lastMessage;
	}
	return next;
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
