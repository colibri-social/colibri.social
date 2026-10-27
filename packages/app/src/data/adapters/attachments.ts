import type {
	AudioAttachmentProps,
	FileAttachmentProps,
	LinkEmbedImageStyle,
	LinkEmbedProps,
	MediaItem,
	RichTextBlock,
	SocialPostAuthor,
	SocialPostEmbedProps,
} from "@colibri-social/ui";
import {
	type AttachmentView,
	EMBEDS_SUPPRESSED_LABEL,
	type EmbedAuthor,
	type EmbedMedia,
	type EmbedRichBlock,
	type GifView,
	type LinkEmbed,
	type MessageView,
} from "../types";
import { formatAge } from "./time";

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
				mimeType: attachment.mimeType,
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

const directImageOf = (embed: LinkEmbed) => {
	const only = embed.media?.length === 1 ? embed.media[0] : undefined;
	return only?.mimeType?.toLowerCase().startsWith("image/") ? only : undefined;
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
	const direct = directImageOf(embed);
	if (direct) {
		return {
			src: direct.url,
			kind: direct.mimeType?.toLowerCase() === "image/gif" ? "gif" : "image",
			width: direct.width,
			height: direct.height,
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

export const gifOfEmbed = (embed: LinkEmbed): GifView | undefined => {
	const media = inlineMediaOf(embed);
	if (media?.kind !== "gif") return undefined;
	return {
		id: embed.uri,
		url: embed.uri,
		previewUrl: embed.image?.url ?? embed.uri,
		width: media.width ?? 0,
		height: media.height ?? 0,
		title: embed.title,
	};
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const accentOf = (embed: LinkEmbed) =>
	embed.themeColor && HEX_COLOR.test(embed.themeColor)
		? embed.themeColor
		: undefined;

const IMAGE_STYLES: Record<string, LinkEmbedImageStyle> = {
	summary: "thumbnail",
	largeImage: "large",
	player: "large",
};

export const embedMediaItem = (media: EmbedMedia): MediaItem | undefined => {
	const sized = {
		width: media.width,
		height: media.height,
		alt: media.alt,
	};
	if (media.kind === "image")
		return { src: media.url, kind: "image", ...sized };
	if (media.kind === "video" || media.kind === "gifv") {
		return {
			src: media.url,
			kind: media.kind === "gifv" ? "gif" : "video",
			mimeType: media.mimeType ?? "video/mp4",
			poster: media.previewUrl,
			...sized,
		};
	}
	return undefined;
};

const mediaItems = (media: readonly EmbedMedia[] | undefined): MediaItem[] =>
	(media ?? [])
		.map(embedMediaItem)
		.filter((item): item is MediaItem => item !== undefined);

export const lightboxMediaOf = (items: readonly MediaItem[]): MediaItem[] =>
	items.map((item) =>
		item.kind === "gif" && item.mimeType?.startsWith("video/")
			? { ...item, kind: "video" }
			: item,
	);

const playerMedia = (embed: LinkEmbed): MediaItem[] => {
	if (!embed.video) return [];
	return [
		{
			src: embed.video.url,
			kind: "video",
			mimeType: embed.video.mimeType,
			width: embed.video.width ?? embed.image?.width,
			height: embed.video.height ?? embed.image?.height,
			poster: embed.image?.url,
			alt: embed.image?.alt ?? embed.title,
		},
	];
};

export const linkEmbedMedia = (embed: LinkEmbed): MediaItem[] => {
	const gallery = mediaItems(embed.media);
	return gallery.length > 0 ? gallery : playerMedia(embed);
};

export const toLinkEmbedProps = (embed: LinkEmbed): LinkEmbedProps => {
	const media = linkEmbedMedia(embed);
	return {
		url: embed.uri,
		siteName: embed.siteName,
		title: embed.title,
		description: embed.description,
		accent: accentOf(embed),
		imageStyle: embed.layout ? IMAGE_STYLES[embed.layout] : undefined,
		provider: embed.provider
			? {
					name: embed.provider.name,
					url: embed.provider.url,
					iconSrc: embed.provider.icon,
				}
			: undefined,
		author: embed.author
			? {
					name: embed.author.name,
					url: embed.author.url,
					avatarSrc: embed.author.avatar,
				}
			: undefined,
		media: media.length > 0 ? media : undefined,
		image: embed.image
			? {
					src: embed.image.url,
					width: embed.image.width,
					height: embed.image.height,
				}
			: undefined,
	};
};

const richBlocks = (blocks: readonly EmbedRichBlock[]): RichTextBlock[] =>
	blocks.map((block) => ({
		kind: block.kind === "quote" ? "quote" : "paragraph",
		spans: block.spans.map((span) => ({
			text: span.text,
			bold: span.bold,
			italic: span.italic,
			href: span.href,
		})),
	}));

const postAuthor = (author: EmbedAuthor): SocialPostAuthor => ({
	name: author.name,
	handle: author.handle,
	url: author.url,
	avatarSrc: author.avatar,
});

const formatPublished = (value: string, locale?: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	try {
		return new Intl.DateTimeFormat(locale, {
			dateStyle: "short",
			timeStyle: "short",
		}).format(date);
	} catch {
		return date.toLocaleString();
	}
};

export const isSocialPostEmbed = (embed: LinkEmbed) =>
	!!embed.post && !!embed.author;

export const toSocialPostProps = (
	embed: LinkEmbed,
	options: { locale?: string; now?: Date } = {},
): SocialPostEmbedProps | undefined => {
	const post = embed.post;
	const author = embed.author;
	if (!post || !author) return undefined;
	const quote = post.quote;
	const footerLabel = embed.provider?.name ?? embed.siteName;
	return {
		url: embed.uri,
		accent: accentOf(embed),
		author: postAuthor(author),
		body: richBlocks(post.body),
		translatedFrom: post.translatedFrom,
		sensitive: post.sensitive,
		contentWarning: post.contentWarning,
		stats: post.stats,
		media: mediaItems(embed.media),
		quote: quote
			? {
					url: quote.uri,
					author: postAuthor(quote.author),
					body: richBlocks(quote.body),
					media: mediaItems(quote.media),
					time: quote.publishedAt
						? formatAge(quote.publishedAt, options.now)
						: undefined,
					translatedFrom: quote.translatedFrom,
				}
			: undefined,
		footer: footerLabel
			? {
					label: footerLabel,
					url: embed.provider?.url,
					iconSrc: embed.provider?.icon,
					time: embed.publishedAt
						? formatPublished(embed.publishedAt, options.locale)
						: undefined,
				}
			: undefined,
	};
};
