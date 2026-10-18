import type { social } from "@colibri-social/lexicons";
import { collapseWhitespace } from "./adapters/facets";
import type { Did, Facet, MessageView, SpaceRef } from "./types";

export type ChannelSummary = {
	channel: SpaceRef;
	rkey: string;
	author: Did;
	text: string;
	facets?: Facet[];
	attachment?: "image" | "file";
	createdAt: string;
};

const attachmentKind = (mimeType: string | undefined) => {
	if (mimeType === undefined) return undefined;
	return mimeType.startsWith("image/") || mimeType.startsWith("video/")
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
	facets: readonly Facet[] | undefined;
	attachment: "image" | "file" | undefined;
	attachmentCount: number;
	forward: boolean;
	createdAt: string;
};

const summaryOf = (fields: SummaryFields): ChannelSummary => {
	const body = collapseWhitespace(fields.text, fields.facets);
	const text =
		body.text ||
		fallbackText(fields.attachment, fields.attachmentCount) ||
		(fields.forward ? "Forwarded a message" : "");
	const summary: ChannelSummary = {
		channel: fields.channel as SpaceRef,
		rkey: fields.rkey,
		author: fields.author as Did,
		text,
		createdAt: fields.createdAt,
	};
	if (body.text && body.facets.length > 0) summary.facets = body.facets;
	if (fields.attachment) summary.attachment = fields.attachment;
	return summary;
};

export const summarizeMessage = (message: MessageView): ChannelSummary =>
	summaryOf({
		channel: message.channel,
		rkey: message.rkey,
		author: message.author.did,
		text: message.text,
		facets: message.facets,
		attachment: attachmentKind(message.attachments[0]?.mimeType),
		attachmentCount: message.attachments.length,
		forward: !!message.forward,
		createdAt: message.createdAt,
	});

export type PendingSummarySource = {
	channel: SpaceRef;
	rkey: string;
	text: string;
	facets?: readonly Facet[];
	attachments?: readonly { mimeType: string }[];
	uploads?: readonly { file: File }[];
	createdAt: string;
};

export const summarizePending = (
	entry: PendingSummarySource,
	author: Did,
): ChannelSummary => {
	const mimeTypes = [
		...(entry.attachments ?? []).map((attachment) => attachment.mimeType),
		...(entry.uploads ?? []).map((upload) => upload.file.type),
	];
	return summaryOf({
		channel: entry.channel,
		rkey: entry.rkey,
		author,
		text: entry.text,
		facets: entry.facets,
		attachment: attachmentKind(mimeTypes[0]),
		attachmentCount: mimeTypes.length,
		forward: false,
		createdAt: entry.createdAt,
	});
};

export const summarizeChannel = (
	view: social.colibri.beta.channel.defs.ChannelSummary,
): ChannelSummary =>
	summaryOf({
		channel: view.channel,
		rkey: view.rkey,
		author: view.author,
		text: view.text,
		facets: view.facets,
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

export type SummaryPart<Emoji> = string | Emoji;

export const summaryParts = <Emoji>(
	summary: Pick<ChannelSummary, "text" | "facets">,
	emojiFor: (feature: Facet["features"][number]) => Emoji | undefined,
): SummaryPart<Emoji>[] => {
	const bytes = new TextEncoder().encode(summary.text);
	const decoder = new TextDecoder();
	const parts: SummaryPart<Emoji>[] = [];
	let cursor = 0;
	const sorted = [...(summary.facets ?? [])].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);
	for (const facet of sorted) {
		if (facet.index.byteStart < cursor) continue;
		const emoji = facet.features
			.map((feature) => emojiFor(feature))
			.find((value) => value !== undefined);
		if (emoji === undefined) continue;
		if (facet.index.byteStart > cursor)
			parts.push(decoder.decode(bytes.subarray(cursor, facet.index.byteStart)));
		parts.push(emoji);
		cursor = facet.index.byteEnd;
	}
	if (cursor < bytes.length) parts.push(decoder.decode(bytes.subarray(cursor)));
	return parts;
};
