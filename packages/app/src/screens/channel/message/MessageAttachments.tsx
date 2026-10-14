import {
	AudioAttachment,
	FileAttachment,
	Lightbox,
	type LightboxAuthor,
	LinkEmbed,
	MediaGrid,
	type MediaItem,
} from "@colibri-social/ui";
import { createSignal, For, type JSX, Show } from "solid-js";
import {
	type SplitAttachments,
	toLinkEmbedProps,
} from "../../../data/adapters/attachments";
import type { LinkEmbed as LinkEmbedView } from "../../../data/types";

export const hasAttachmentContent = (
	split: SplitAttachments,
	embeds: readonly LinkEmbedView[],
) =>
	split.media.length > 0 ||
	split.audio.length > 0 ||
	split.files.length > 0 ||
	embeds.length > 0;

export const MediaWithLightbox = (props: {
	items: MediaItem[];
	author?: LightboxAuthor;
	timestamp?: string;
	locale?: string;
}) => {
	const [open, setOpen] = createSignal(false);
	const [mounted, setMounted] = createSignal(false);
	const [index, setIndex] = createSignal(0);
	return (
		<>
			<MediaGrid
				items={props.items}
				onOpen={(next) => {
					setIndex(next);
					setMounted(true);
					setOpen(true);
				}}
			/>
			<Show when={mounted()}>
				<Lightbox
					items={props.items}
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
}) => {
	const [open, setOpen] = createSignal(false);
	const [mounted, setMounted] = createSignal(false);
	const items = () => embedMedia(props.embed);
	return (
		<>
			<LinkEmbed
				{...toLinkEmbedProps(props.embed)}
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

export const MessageAttachments = (props: {
	split: SplitAttachments;
	embeds: readonly LinkEmbedView[];
	author?: LightboxAuthor;
	timestamp?: string;
	locale?: string;
}): JSX.Element => (
	<div data-message-attachments="" class="flex min-w-0 flex-col gap-2">
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
				<EmbedWithLightbox
					embed={embed}
					author={props.author}
					timestamp={props.timestamp}
					locale={props.locale}
				/>
			)}
		</For>
	</div>
);
