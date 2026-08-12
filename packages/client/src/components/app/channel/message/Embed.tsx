import type {
	ColibriRichTextFacet,
	ColibriRichTextLink,
} from "@colibri-social/lib";
import { type Component, createResource, createSignal, Show } from "solid-js";
import StarIcon from "~icons/ph/star";
import StarFillIcon from "~icons/ph/star-fill";
import { parseBskyPostUrl } from "../../../../atproto/bsky-post-url";
import {
	getMetadataDeduped,
	peekMetadata,
} from "../../../../atproto/embed-metadata-cache";
import { resolveEmbedImage } from "../../../../atproto/resolve-blob";
import type { GifItem } from "../../../../atproto/xrpc/social/colibri/embed/gifTypes";
import { useGifFavorites } from "../../../../contexts/GifFavorites";
import { useUserContext } from "../../../../contexts/User";
import { openExternalLink } from "../../../../utils/open-external-link";
import { Lightbox } from "../../common/Lightbox";
import {
	MediaLightboxGallery,
	rememberAspectRatio,
	reservedAspectRatio,
} from "./Attachments";
import { BlueskyEmbed } from "./BlueskyEmbed";

/** Matches direct GIF/animated-image media URLs (ignoring query/hash). */
const GIF_MEDIA_EXT = /\.(gif|gifv|webp)(\?|#|$)/i;

/** Matches direct static raster image URLs (ignoring query/hash). */
const STATIC_IMAGE_EXT = /\.(png|jpe?g|avif|bmp)(\?|#|$)/i;

/**
 * True for links that point at an animated image we can show inline (Discord-
 * style) rather than scraping into an OpenGraph card — e.g. a Klipy GIF picked
 * from the chat-bar picker.
 */
export const isGifUrl = (uri: string): boolean => {
	try {
		const url = new URL(uri);
		return GIF_MEDIA_EXT.test(url.pathname) || /klipy/i.test(url.hostname);
	} catch {
		return false;
	}
};

export const isStaticImageUrl = (uri: string): boolean => {
	try {
		const url = new URL(uri);
		return STATIC_IMAGE_EXT.test(url.pathname);
	} catch {
		return false;
	}
};

export const isDirectMediaUrl = (uri: string): boolean =>
	isGifUrl(uri) || isStaticImageUrl(uri);

export const usesLinkPreview = (uri: string): boolean =>
	!isDirectMediaUrl(uri) && !parseBskyPostUrl(uri);

export const gifItemFromUrl = (uri: string): GifItem => ({
	id: uri,
	mediaUrl: uri,
	previewUrl: uri,
});

export const gifLinkFromFacets = (
	facets?: Array<ColibriRichTextFacet>,
): string | undefined => {
	for (const facet of facets ?? []) {
		for (const feature of facet.features) {
			if (feature.$type !== "social.colibri.richtext.facet#link") continue;
			const { uri } = feature as ColibriRichTextLink;
			if (isGifUrl(uri)) return uri;
		}
	}
	return undefined;
};

const [brokenMediaLinks, setBrokenMediaLinks] = createSignal<
	ReadonlySet<string>
>(new Set());

export const isBrokenMediaLink = (uri: string): boolean =>
	brokenMediaLinks().has(uri);

const markMediaLinkBroken = (uri: string) => {
	setBrokenMediaLinks((prev) =>
		prev.has(uri) ? prev : new Set(prev).add(uri),
	);
};

/** Renders a GIF link as the animated image itself, hotlinked from its CDN. */
const InlineGif: Component<{ uri: string }> = (props) => {
	const { isFavorited, toggleFavorite } = useGifFavorites();

	// A chat GIF is identified by its media URL (no Klipy slug here); the
	// favorites store matches on either id or mediaUrl.
	const gif = (): GifItem => gifItemFromUrl(props.uri);

	return (
		<div class="group/gif relative w-fit">
			<Lightbox src={props.uri}>
				<img
					class="max-w-64 w-full h-auto rounded-md bg-muted border-none cursor-pointer"
					style={{
						"aspect-ratio": reservedAspectRatio({ url: props.uri }) ?? "16 / 9",
					}}
					src={props.uri}
					alt="GIF"
					loading="lazy"
					onLoad={(e) => rememberAspectRatio(props.uri, e.target)}
					onError={() => markMediaLinkBroken(props.uri)}
				/>
			</Lightbox>
			<button
				type="button"
				title={isFavorited(gif()) ? "Remove favorite" : "Add favorite"}
				class="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white border-none cursor-pointer opacity-0 group-hover/gif:opacity-100 focus-visible:opacity-100 hover:bg-black/70 transition-opacity"
				classList={{ "opacity-100": isFavorited(gif()) }}
				onClick={(e) => {
					e.stopPropagation();
					void toggleFavorite(gif());
				}}
			>
				<Show when={isFavorited(gif())} fallback={<StarIcon class="w-4 h-4" />}>
					<StarFillIcon class="w-4 h-4 text-yellow-400" />
				</Show>
			</button>
		</div>
	);
};

const InlineImage: Component<{ uri: string }> = (props) => {
	return (
		<MediaLightboxGallery
			images={[{ url: props.uri }]}
			onImageError={() => markMediaLinkBroken(props.uri)}
		/>
	);
};

export const Embed: Component<{ uri: string }> = (props) => {
	// Bluesky post links get a native post card instead of OG scraping
	const bskyPost = () => parseBskyPostUrl(props.uri);

	return (
		<Show
			when={isGifUrl(props.uri)}
			fallback={
				<Show
					when={isStaticImageUrl(props.uri)}
					fallback={
						<Show
							when={bskyPost()}
							fallback={<OpenGraphEmbed uri={props.uri} />}
						>
							{(post) => <BlueskyEmbed uri={props.uri} post={post()} />}
						</Show>
					}
				>
					<InlineImage uri={props.uri} />
				</Show>
			}
		>
			<InlineGif uri={props.uri} />
		</Show>
	);
};

const OpenGraphEmbed: Component<{ uri: string }> = (props) => {
	const user = useUserContext();

	const [embedData] = createResource(
		() => props.uri,
		(uri) => getMetadataDeduped(user.xrpc, uri),
		{ initialValue: peekMetadata(props.uri) },
	);

	const data = () => embedData();
	const hasContent = () =>
		!!data() && !!(data()!.title || data()!.description || data()!.image);
	const isThumbnail = () => !!data()?.image && data()!.largeImage === false;
	const imageUrl = () => {
		const img = data()?.image?.[0];
		return img ? resolveEmbedImage(img.url) : undefined;
	};
	const imageAlt = () => data()?.image?.[0]?.alt || "";
	const previewImage = () => {
		const img = data()?.image?.[0];
		if (!img) return undefined;
		return { url: imageUrl(), width: img.width, height: img.height };
	};

	return (
		<div>
			<Show when={hasContent()}>
				<div
					class="flex flex-col border-l-4 p-3 pt-2 bg-card mb-2 rounded-r-md max-w-104 min-w-0"
					style={{ "border-color": data()!.themeColor || "var(--border)" }}
				>
					<div
						class="flex gap-3"
						classList={{
							"flex-row items-start": isThumbnail(),
							"flex-col": !isThumbnail(),
						}}
					>
						<div class="flex flex-col min-w-0 flex-1">
							<Show when={data()!.siteName}>
								<span class="text-xs text-card-foreground/70">
									{data()!.siteName}
								</span>
							</Show>
							<Show when={data()!.title}>
								<a
									class="font-semibold w-fit wrap-anywhere text-(--primary-hover)! decoration-(--primary-hover) hover:underline"
									href={props.uri}
									target="_blank"
									rel="noreferrer"
									onClick={(e) => openExternalLink(props.uri, e)}
								>
									{data()!.title}
								</a>
							</Show>
							<Show when={data()!.description}>
								<span class="font-light text-card-foreground text-sm mt-0.5 line-clamp-2 overflow-hidden text-ellipsis">
									{data()!.description}
								</span>
							</Show>
						</div>
						<Show when={isThumbnail() && imageUrl()}>
							<Lightbox src={imageUrl()!}>
								<img
									width={64}
									height={64}
									class="w-16 h-16 object-cover rounded-sm bg-muted shrink-0 cursor-pointer"
									src={imageUrl()}
									alt={imageAlt()}
								/>
							</Lightbox>
						</Show>
					</div>
					<Show when={!isThumbnail() && imageUrl()}>
						<Lightbox src={imageUrl()!}>
							<img
								class="w-full h-auto rounded-sm mt-2 bg-muted border-none cursor-pointer"
								style={{
									"aspect-ratio":
										reservedAspectRatio(previewImage()) ?? "16 / 9",
								}}
								src={imageUrl()}
								alt={imageAlt()}
								onLoad={(e) => rememberAspectRatio(imageUrl(), e.target)}
							/>
						</Lightbox>
					</Show>
				</div>
			</Show>
		</div>
	);
};
