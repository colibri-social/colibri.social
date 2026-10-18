import type { social } from "@colibri-social/lexicons";
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

type SummaryFields = {
	channel: string;
	rkey: string;
	author: string;
	text: string;
	attachment: "image" | "file" | undefined;
	attachmentCount: number;
	forward: boolean;
	createdAt: string;
};

const summaryOf = (fields: SummaryFields): ChannelSummary => {
	const text =
		fields.text.replace(/\s+/g, " ").trim() ||
		fallbackText(fields.attachment, fields.attachmentCount) ||
		(fields.forward ? "Forwarded a message" : "");
	const summary: ChannelSummary = {
		channel: fields.channel as SpaceRef,
		rkey: fields.rkey,
		author: fields.author as Did,
		text,
		createdAt: fields.createdAt,
	};
	if (fields.attachment) summary.attachment = fields.attachment;
	return summary;
};

export const summarizeMessage = (message: MessageView): ChannelSummary =>
	summaryOf({
		channel: message.channel,
		rkey: message.rkey,
		author: message.author.did,
		text: message.text,
		attachment: attachmentKind(message),
		attachmentCount: message.attachments.length,
		forward: !!message.forward,
		createdAt: message.createdAt,
	});

export const summarizeChannel = (
	view: social.colibri.beta.channel.defs.ChannelSummary,
): ChannelSummary =>
	summaryOf({
		channel: view.channel,
		rkey: view.rkey,
		author: view.author,
		text: view.text,
		attachment:
			view.attachmentKind === "image"
				? "image"
				: view.attachmentKind === "file"
					? "file"
					: undefined,
		attachmentCount: view.attachmentCount,
		forward: view.forward,
		createdAt: view.createdAt,
	});

export const newerSummary = (
	current: ChannelSummary | undefined,
	next: ChannelSummary,
) =>
	!current || next.rkey === current.rkey || next.createdAt >= current.createdAt;
