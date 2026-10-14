import type { Did, MessageView, SpaceRef } from "./types";

export type ChannelSummary = {
	channel: SpaceRef;
	rkey: string;
	author: Did;
	text: string;
	attachment?: "image" | "file";
	createdAt: string;
};

const attachmentKind = (message: MessageView) => {
	const first = message.attachments[0];
	if (!first) return undefined;
	return first.mimeType.startsWith("image/") ||
		first.mimeType.startsWith("video/")
		? "image"
		: "file";
};

const fallbackText = (kind: "image" | "file" | undefined, count: number) => {
	if (kind === "image")
		return count > 1 ? `Sent ${count} images` : "Sent an image";
	if (kind === "file") return count > 1 ? `Sent ${count} files` : "Sent a file";
	return "";
};

export const summarizeMessage = (message: MessageView): ChannelSummary => {
	const attachment = attachmentKind(message);
	const text =
		message.text.replace(/\s+/g, " ").trim() ||
		fallbackText(attachment, message.attachments.length) ||
		(message.forward ? "Forwarded a message" : "");
	const summary: ChannelSummary = {
		channel: message.channel as SpaceRef,
		rkey: message.rkey,
		author: message.author.did as Did,
		text,
		createdAt: message.createdAt,
	};
	if (attachment) summary.attachment = attachment;
	return summary;
};

export const newerSummary = (
	current: ChannelSummary | undefined,
	next: ChannelSummary,
) =>
	!current || next.rkey === current.rkey || next.createdAt >= current.createdAt;
