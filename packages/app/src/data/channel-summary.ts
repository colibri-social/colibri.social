import type { social } from "@colibri-social/lexicons";
import { isGifSiteUrl } from "./adapters/attachments";
import { collapseWhitespace, linkUriOf } from "./adapters/facets";
import type { Did, Facet, MessageView, ProfileView, SpaceRef } from "./types";

export type ChannelSummary = {
	channel: SpaceRef;
	rkey: string;
	author: Did;
	authorProfile?: ProfileView;
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

export type ServedChannelSummary =
	social.colibri.beta.channel.defs.ChannelSummary & {
		authorProfile?: ProfileView;
	};

type SummaryFields = {
	channel: string;
	rkey: string;
	author: string;
	authorProfile: ProfileView | undefined;
	text: string;
	facets: readonly Facet[] | undefined;
	attachment: "image" | "file" | undefined;
	attachmentCount: number;
	forward: boolean;
	createdAt: string;
};

const isGifText = (text: string) => {
	return /^\S+$/.test(text) && isGifSiteUrl(text);
};

const isProfile = (value: unknown): value is ProfileView =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { did?: unknown }).did === "string" &&
	typeof (value as { handle?: unknown }).handle === "string";

const summaryOf = (fields: SummaryFields): ChannelSummary => {
	const body = collapseWhitespace(fields.text, fields.facets);
	const authorProfile = isProfile(fields.authorProfile)
		? { authorProfile: fields.authorProfile }
		: {};

	if (isGifText(body.text)) {
		return {
			channel: fields.channel as SpaceRef,
			rkey: fields.rkey,
			author: fields.author as Did,
			...authorProfile,
			text: "Sent a GIF",
			attachment: "image",
			createdAt: fields.createdAt,
		};
	}

	const text =
		body.text ||
		fallbackText(fields.attachment, fields.attachmentCount) ||
		(fields.forward ? "Forwarded a message" : "");
	const summary: ChannelSummary = {
		channel: fields.channel as SpaceRef,
		rkey: fields.rkey,
		author: fields.author as Did,
		...authorProfile,
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
		authorProfile: message.author.bridge ? message.author : undefined,
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
		authorProfile: undefined,
		text: entry.text,
		facets: entry.facets,
		attachment: attachmentKind(mimeTypes[0]),
		attachmentCount: mimeTypes.length,
		forward: false,
		createdAt: entry.createdAt,
	});
};

export const summarizeChannel = (view: ServedChannelSummary): ChannelSummary =>
	summaryOf({
		channel: view.channel,
		rkey: view.rkey,
		author: view.author,
		authorProfile: view.authorProfile,
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

const bareLinkRewrite = (
	facet: Facet,
	label: string,
	rewriteUrl: ((uri: string) => string) | undefined,
) => {
	if (!rewriteUrl) return undefined;

	const uri = facet.features
		.map((feature) => linkUriOf(feature))
		.find((value) => value !== undefined);
	if (uri === undefined || label !== uri) return undefined;

	const rewritten = rewriteUrl(uri);

	return rewritten === uri ? undefined : rewritten;
};

export const summaryParts = <Emoji>(
	summary: Pick<ChannelSummary, "text" | "facets">,
	emojiFor: (feature: Facet["features"][number]) => Emoji | undefined,
	rewriteUrl?: (uri: string) => string,
): SummaryPart<Emoji>[] => {
	const bytes = new TextEncoder().encode(summary.text);
	const decoder = new TextDecoder();
	const parts: SummaryPart<Emoji>[] = [];
	let text = "";
	let cursor = 0;
	const sorted = [...(summary.facets ?? [])].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);

	const flush = () => {
		if (text) parts.push(text);
		text = "";
	};

	for (const facet of sorted) {
		if (facet.index.byteStart < cursor) continue;

		const emoji = facet.features
			.map((feature) => emojiFor(feature))
			.find((value) => value !== undefined);
		const label =
			emoji === undefined
				? decoder.decode(
						bytes.subarray(facet.index.byteStart, facet.index.byteEnd),
					)
				: "";
		const link =
			emoji === undefined
				? bareLinkRewrite(facet, label, rewriteUrl)
				: undefined;
		if (emoji === undefined && link === undefined) continue;

		if (facet.index.byteStart > cursor)
			text += decoder.decode(bytes.subarray(cursor, facet.index.byteStart));

		if (emoji === undefined) {
			text += link;
		} else {
			flush();
			parts.push(emoji);
		}

		cursor = facet.index.byteEnd;
	}

	if (cursor < bytes.length) text += decoder.decode(bytes.subarray(cursor));
	flush();

	return parts;
};
