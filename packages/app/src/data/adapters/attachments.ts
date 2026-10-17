import type {
	AudioAttachmentProps,
	FileAttachmentProps,
	LinkEmbedProps,
	MediaItem,
} from "@colibri-social/ui";
import {
	type AttachmentView,
	EMBEDS_SUPPRESSED_LABEL,
	type GifView,
	type LinkEmbed,
	type MessageView,
} from "../types";

export type SplitAttachments = {
	media: MediaItem[];
	audio: AudioAttachmentProps[];
	files: FileAttachmentProps[];
};

const fileName = (attachment: AttachmentView) => {
	if (attachment.name) return attachment.name;
	try {
		const path = new URL(attachment.url).pathname;
		return decodeURIComponent(path.split("/").pop() || "file");
	} catch {
		return "file";
	}
};

export const mediaKindOf = (
	mimeType: string,
): MediaItem["kind"] | undefined => {
	const type = mimeType.toLowerCase();
	if (type === "image/gif") return "gif";
	if (type.startsWith("image/")) return "image";
	if (type.startsWith("video/")) return "video";
	return undefined;
};

export const splitAttachments = (
	attachments: readonly AttachmentView[] = [],
	progress: readonly (number | undefined)[] = [],
): SplitAttachments => {
	const result: SplitAttachments = { media: [], audio: [], files: [] };
	for (const [index, attachment] of attachments.entries()) {
		const uploading = progress[index];
		const name = fileName(attachment);
		const kind = mediaKindOf(attachment.mimeType);
		const spoiler = attachment.spoiler === true ? { spoiler: true } : {};
		if (kind) {
			result.media.push({
				src: attachment.url,
				width: attachment.width,
				height: attachment.height,
				name,
				alt: attachment.alt,
				kind,
				downloadHref: attachment.url,
				progress: uploading,
				...spoiler,
			});
			continue;
		}
		if (attachment.mimeType.toLowerCase().startsWith("audio/")) {
			result.audio.push({
				name,
				size: attachment.size ?? 0,
				src: attachment.url,
				href: attachment.url,
				...spoiler,
			});
			continue;
		}
		result.files.push({
			name,
			size: attachment.size ?? 0,
			mimeType: attachment.mimeType,
			href: attachment.url,
			progress: uploading,
			...spoiler,
		});
	}
	return result;
};

export type EmbedSuppression = {
	all: boolean;
	author: readonly string[];
	moderator: readonly string[];
};

type SuppressionSource = Pick<MessageView, "suppressedEmbeds" | "labels">;

export const embedSuppression = (
	message: Partial<SuppressionSource> | undefined,
): EmbedSuppression => {
	const author = [...(message?.suppressedEmbeds ?? [])];
	const authorSet = new Set<string>(author);
	const moderator = new Set<string>();
	let all = false;
	for (const label of message?.labels ?? []) {
		if (label.val !== EMBEDS_SUPPRESSED_LABEL) continue;
		if (!label.scope?.length) {
			all = true;
			continue;
		}
		for (const uri of label.scope) {
			if (!authorSet.has(uri)) moderator.add(uri);
		}
	}
	return { all, author, moderator: [...moderator] };
};

export const isEmbedSuppressed = (suppression: EmbedSuppression, uri: string) =>
	suppression.all ||
	suppression.author.includes(uri) ||
	suppression.moderator.includes(uri);

export const visibleEmbeds = (
	embeds: readonly LinkEmbed[] | undefined,
	suppression: EmbedSuppression,
) => {
	if (!embeds?.length) return [];
	return embeds.filter((embed) => !isEmbedSuppressed(suppression, embed.uri));
};

export const embedHost = (uri: string) => {
	try {
		return new URL(uri).host;
	} catch {
		return uri;
	}
};

export const gifOfAttachments = (
	attachments: readonly AttachmentView[] | undefined,
): GifView | undefined => {
	const media = attachments ?? [];
	if (media.length !== 1) return undefined;
	const attachment = media[0];
	if (!attachment || mediaKindOf(attachment.mimeType) !== "gif") {
		return undefined;
	}
	return {
		id: attachment.url,
		url: attachment.url,
		previewUrl: attachment.url,
		width: attachment.width ?? 0,
		height: attachment.height ?? 0,
		title: attachment.name?.replace(/\.gif$/i, ""),
	};
};

const GIF_HOSTS = ["tenor.com", "giphy.com", "klipy.com"];
const ANIMATED_IMAGE_PATH = /\.(gif|webp)$/i;
const STILL_IMAGE_PATH = /\.(png|jpe?g|avif)$/i;
const VIDEO_PATH = /\.(mp4|m4v|webm)$/i;

const parseUrl = (uri: string) => {
	try {
		return new URL(uri);
	} catch {
		return undefined;
	}
};

const isGifHost = (host: string) =>
	GIF_HOSTS.some((gifHost) => host === gifHost || host.endsWith(`.${gifHost}`));

export const isGifSiteUrl = (uri: string) => {
	const url = parseUrl(uri);
	return !!url && isGifHost(url.hostname);
};

export const inlineMediaOf = (embed: LinkEmbed): MediaItem | undefined => {
	const url = parseUrl(embed.uri);
	if (!url) return undefined;
	const alt = embed.image?.alt ?? embed.title;
	if (isGifHost(url.hostname) && embed.image) {
		return {
			src: embed.image.url,
			kind: "gif",
			width: embed.image.width ?? embed.video?.width,
			height: embed.image.height ?? embed.video?.height,
			alt,
		};
	}
	if (embed.image && ANIMATED_IMAGE_PATH.test(url.pathname)) {
		return {
			src: embed.image.url,
			kind: "gif",
			width: embed.image.width,
			height: embed.image.height,
		};
	}
	if (embed.image && STILL_IMAGE_PATH.test(url.pathname)) {
		return {
			src: embed.image.url,
			kind: "image",
			width: embed.image.width,
			height: embed.image.height,
		};
	}
	if (embed.video && VIDEO_PATH.test(url.pathname)) {
		return {
			src: embed.video.url,
			kind: "video",
			width: embed.video.width,
			height: embed.video.height,
		};
	}
	return undefined;
};

export const toLinkEmbedProps = (embed: LinkEmbed): LinkEmbedProps => ({
	url: embed.uri,
	siteName: embed.siteName,
	title: embed.title,
	description: embed.description,
	image: embed.image
		? {
				src: embed.image.url,
				width: embed.image.width,
				height: embed.image.height,
			}
		: undefined,
});
