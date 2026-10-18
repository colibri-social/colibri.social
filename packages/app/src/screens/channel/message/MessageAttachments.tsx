import {
	AudioAttachment,
	BlueskyPostEmbed,
	BlueskyPostEmbedSkeleton,
	FileAttachment,
	Lightbox,
	type LightboxAuthor,
	LinkEmbed,
	MediaGrid,
	type MediaItem,
	type RichTextExternalLink,
} from "@colibri-social/ui";
import {
	createResource,
	createSignal,
	For,
	type JSX,
	Match,
	Show,
	Switch,
} from "solid-js";
import {
	inlineMediaOf,
	type SplitAttachments,
	toLinkEmbedProps,
} from "../../../data/adapters/attachments";
import {
	parseBlueskyPostUrl,
	toBlueskyPost,
} from "../../../data/adapters/bluesky-post";
import { blueskyClientOf } from "../../../data/bluesky-client";
import { useMediaLinkRefresher } from "../../../data/media-link-context";
import { useData } from "../../../data/store";
import type {
	BlueskyPostView,
	LinkEmbed as LinkEmbedView,
} from "../../../data/types";
import { externalAnchorOf } from "../../../native/open-external";
import { lightboxImageActions } from "./image-actions";

const routeEmbedLink = (
	event: MouseEvent,
	onExternalLink?: (href: string, link: RichTextExternalLink) => void,
) => {
	if (!onExternalLink || event.defaultPrevented || event.button !== 0) return;
	const anchor = externalAnchorOf(event);
	if (!anchor?.closest("[data-link-embed], [data-bluesky-embed]")) return;
	event.preventDefault();
	onExternalLink(anchor.href, {
		label: anchor.textContent?.trim() ?? anchor.href,
		disguised: false,
	});
};

export type LoadBlueskyPost = (
	url: string,
) => Promise<BlueskyPostView | undefined>;

export type RemoveEmbed = (uri: string, event: MouseEvent) => void;

export const hasAttachmentContent = (
	split: SplitAttachments,
	embeds: readonly LinkEmbedView[],
	blueskyLinks: readonly string[] = [],
) =>
	split.media.length > 0 ||
	split.audio.length > 0 ||
	split.files.length > 0 ||
	embeds.length > 0 ||
	blueskyLinks.length > 0;

export const MediaWithLightbox = (props: {
	items: MediaItem[];
	author?: LightboxAuthor;
	timestamp?: string;
	locale?: string;
}) => {
	const [open, setOpen] = createSignal(false);
	const [mounted, setMounted] = createSignal(false);
	const [index, setIndex] = createSignal(0);
	const links = useMediaLinkRefresher();
	const srcAt = (at: number) => props.items[at]?.src;
	return (
		<>
			<MediaGrid
				items={props.items}
				onMediaError={(at) => {
					const src = srcAt(at);
					return src && links ? links.refresh(src) : undefined;
				}}
				onRetry={(at) => {
					const src = srcAt(at);
					if (src) links?.retry(src);
				}}
				onOpen={(next) => {
					setIndex(next);
					setMounted(true);
					setOpen(true);
				}}
			/>
			<Show when={mounted()}>
				<Lightbox
					items={props.items}
					{...lightboxImageActions(() => props.items)}
					open={open()}
					onOpenChange={setOpen}
					index={index()}
					onIndexChange={setIndex}
					author={props.author}
					timestamp={props.timestamp}
					locale={props.locale}
				/>
			</Show>
		</>
	);
};

const embedMedia = (embed: LinkEmbedView): MediaItem[] => {
	if (embed.video) {
		return [
			{
				src: embed.video.url,
				kind: "video",
				width: embed.video.width ?? embed.image?.width,
				height: embed.video.height ?? embed.image?.height,
				poster: embed.image?.url,
				alt: embed.image?.alt ?? embed.title,
			},
		];
	}
	if (!embed.image) return [];
	return [
		{
			src: embed.image.url,
			kind: "image",
			width: embed.image.width,
			height: embed.image.height,
			alt: embed.image.alt ?? embed.title,
		},
	];
};

export const EmbedWithLightbox = (props: {
	embed: LinkEmbedView;
	author?: LightboxAuthor;
	timestamp?: string;
	locale?: string;
	onRemove?: RemoveEmbed;
}) => {
	const [open, setOpen] = createSignal(false);
	const [mounted, setMounted] = createSignal(false);
	const items = () => embedMedia(props.embed);
	return (
		<>
			<LinkEmbed
				{...toLinkEmbedProps(props.embed)}
				onRemove={
					props.onRemove
						? (event) => props.onRemove?.(props.embed.uri, event)
						: undefined
				}
				onOpenImage={
					items().length > 0
						? () => {
								setMounted(true);
								setOpen(true);
							}
						: undefined
				}
			/>
			<Show when={mounted()}>
				<Lightbox
					items={items()}
					{...lightboxImageActions(items)}
					open={open()}
					onOpenChange={setOpen}
					index={0}
					author={props.author}
					timestamp={props.timestamp}
					locale={props.locale}
				/>
			</Show>
		</>
	);
};

const blueskyPostItems = (post: BlueskyPostView): MediaItem[] =>
	(post.images ?? []).map((image) => ({
		src: image.url,
		kind: "image",
		width: image.width,
		height: image.height,
		alt: image.alt,
	}));

export const BlueskyEmbed = (props: {
	url: string;
	fallback?: LinkEmbedView;
	load?: LoadBlueskyPost;
	author?: LightboxAuthor;
	timestamp?: string;
	locale?: string;
	onRemove?: RemoveEmbed;
}) => {
	const data = useData();
	const [post] = createResource(
		() => (props.load ? props.url : undefined),
		(url) => props.load?.(url).catch(() => undefined),
	);
	const [open, setOpen] = createSignal(false);
	const [mounted, setMounted] = createSignal(false);
	const [index, setIndex] = createSignal(0);
	const fallback = () => (
		<Show when={props.fallback}>
			{(embed) => (
				<EmbedWithLightbox
					embed={embed()}
					author={props.author}
					timestamp={props.timestamp}
					locale={props.locale}
					onRemove={props.onRemove}
				/>
			)}
		</Show>
	);
	return (
		<Switch fallback={fallback()}>
			<Match when={post.loading}>
				<BlueskyPostEmbedSkeleton />
			</Match>
			<Match when={post()}>
				{(view) => (
					<>
						<BlueskyPostEmbed
							post={toBlueskyPost(view(), blueskyClientOf(data.preferences))}
							onRemove={
								props.onRemove
									? (event) => props.onRemove?.(props.url, event)
									: undefined
							}
							onOpenImage={(next) => {
								setIndex(next);
								setMounted(true);
								setOpen(true);
							}}
						/>
						<Show when={mounted()}>
							<Lightbox
								items={blueskyPostItems(view())}
								{...lightboxImageActions(() => blueskyPostItems(view()))}
								open={open()}
								onOpenChange={setOpen}
								index={index()}
								onIndexChange={setIndex}
								author={props.author}
								timestamp={props.timestamp}
								locale={props.locale}
							/>
						</Show>
					</>
				)}
			</Match>
		</Switch>
	);
};

export const MessageAttachments = (props: {
	split: SplitAttachments;
	embeds: readonly LinkEmbedView[];
	blueskyLinks?: readonly string[];
	loadBlueskyPost?: LoadBlueskyPost;
	onRemoveEmbed?: RemoveEmbed;
	author?: LightboxAuthor;
	timestamp?: string;
	locale?: string;
	onExternalLink?: (href: string, link: RichTextExternalLink) => void;
}): JSX.Element => (
	<div
		data-message-attachments=""
		class="flex min-w-0 flex-col gap-2"
		onClick={(event) => routeEmbedLink(event, props.onExternalLink)}
	>
		<Show when={props.split.media.length > 0}>
			<MediaWithLightbox
				items={props.split.media}
				author={props.author}
				timestamp={props.timestamp}
				locale={props.locale}
			/>
		</Show>
		<For each={props.split.audio}>
			{(audio) => <AudioAttachment {...audio} />}
		</For>
		<For each={props.split.files}>{(file) => <FileAttachment {...file} />}</For>
		<For each={props.embeds}>
			{(embed) => (
				<Switch
					fallback={
						<EmbedWithLightbox
							embed={embed}
							author={props.author}
							timestamp={props.timestamp}
							locale={props.locale}
							onRemove={props.onRemoveEmbed}
						/>
					}
				>
					<Match when={inlineMediaOf(embed)}>
						{(media) => (
							<div data-inline-media="">
								<MediaWithLightbox
									items={[media()]}
									author={props.author}
									timestamp={props.timestamp}
									locale={props.locale}
								/>
							</div>
						)}
					</Match>
					<Match when={props.loadBlueskyPost && parseBlueskyPostUrl(embed.uri)}>
						<BlueskyEmbed
							url={embed.uri}
							fallback={embed}
							load={props.loadBlueskyPost}
							author={props.author}
							timestamp={props.timestamp}
							locale={props.locale}
							onRemove={props.onRemoveEmbed}
						/>
					</Match>
				</Switch>
			)}
		</For>
		<For each={props.blueskyLinks ?? []}>
			{(url) => (
				<BlueskyEmbed
					url={url}
					load={props.loadBlueskyPost}
					author={props.author}
					timestamp={props.timestamp}
					locale={props.locale}
					onRemove={props.onRemoveEmbed}
				/>
			)}
		</For>
	</div>
);
