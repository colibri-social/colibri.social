import { type Component, For, Show } from "solid-js";
import "vidstack/bundle";
import "vidstack/player";
import "vidstack/player/layouts";
import "vidstack/player/ui";

import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";
import "vidstack/player/styles/default/layouts/audio.css";
import type { AttachmentObj } from "@colibri-social/lib";
import FileIcon from "~icons/ph/file";
import { resolveBlob } from "../../../../atproto/resolve-blob";
import type { Message } from "../../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useChannelContext } from "../../../../contexts/Channel";
import { useStableMedia } from "../../../../contexts/ScrollAnchor";
import { Lightbox } from "../../common/Lightbox";

type AttachmentComponent = Component<{ item: AttachmentObj; did: string }>;

export const AudioAttachment: AttachmentComponent = (props) => {
	const _channel = useChannelContext();
	const stableMedia = useStableMedia();

	return (
		// @ts-expect-error - Test
		<media-player
			ref={stableMedia}
			class="max-h-96 max-w-104 rounded-sm"
			title={props.item.name ?? "Audio"}
			load="eager"
			viewType="audio"
			storage={resolveBlob(props.did, props.item.blob)}
			streamType="on-demand"
			onCanPlay={() => {
				// TODO: notifyEmbedLoad
			}}
		>
			{/* @ts-expect-error */}
			<media-provider>
				<source
					src={resolveBlob(props.did, props.item.blob)}
					type={props.item.blob.mimeType}
				/>
				{/* @ts-expect-error */}
			</media-provider>
			{/* @ts-expect-error */}
			<media-audio-layout />
			{/* @ts-expect-error */}
		</media-player>
	);
};

export const ImageAttachment: AttachmentComponent = (props) => {
	const stableMedia = useStableMedia();

	return (
		<Lightbox src={resolveBlob(props.did, props.item.blob)!}>
			<img
				ref={stableMedia}
				src={resolveBlob(props.did, props.item.blob)}
				class="max-h-52 max-w-96 object-cover rounded-sm"
				alt={props.item.name ?? ""}
			/>
		</Lightbox>
	);
};

export const VideoAttachment: AttachmentComponent = (props) => {
	const stableMedia = useStableMedia();

	return (
		// @ts-expect-error
		<media-player
			ref={stableMedia}
			class="max-h-96 max-w-104 rounded-sm"
			title={props.item.name ?? "Video"}
			load="eager"
			viewType="video"
			storage={resolveBlob(props.did, props.item.blob)}
			streamType="on-demand"
			// onCanPlay={notifyEmbedLoad}
		>
			{/* @ts-expect-error */}
			<media-provider>
				<source
					src={resolveBlob(props.did, props.item.blob)}
					type={props.item.blob.mimeType}
				/>
				{/* @ts-expect-error */}
			</media-provider>
			{/* @ts-expect-error */}
			<media-video-layout />
			{/* @ts-expect-error */}
		</media-player>
	);
};

export const GenericFileAttachment: AttachmentComponent = (props) => {
	return (
		<a
			class="flex flex-row gap-2 items-center border border-border rounded-sm w-104 p-2 hover:bg-card"
			href={resolveBlob(props.did, props.item.blob)!}
			target="_blank"
			rel="noreferrer"
		>
			<FileIcon class="min-w-10 w-10 h-10" />
			<div class="flex flex-col w-full">
				<span class="text-ellipsis w-[calc(100%-3rem)] text-nowrap overflow-hidden">
					{props.item.name ?? "File"}
				</span>
				<span class="text-sm text-muted-foreground">
					{props.item.blob.mimeType}
				</span>
			</div>
		</a>
	);
};

export const MessageAttachments: Component<{
	did: string;
	attachments: Message["attachments"];
	disableHover?: boolean;
}> = (props) => {
	/**
	 * Returns all non-displayable files which should be rendered as a box.
	 */
	const nonDisplayableFiles = () =>
		props.attachments.filter(
			(x) =>
				!x.blob.mimeType.includes("image/") &&
				!x.blob.mimeType.includes("video/") &&
				!x.blob.mimeType.includes("audio/"),
		);

	/**
	 * Returns all audio files.
	 */
	const audioFiles = () =>
		props.attachments.filter((x) => x.blob.mimeType.includes("audio/"));

	/**
	 * Returns all image files.
	 */
	const imageFiles = () =>
		props.attachments.filter((x) => x.blob.mimeType.includes("image/"));
	/**
	 * Returns all video files.
	 */
	const videoFiles = () =>
		props.attachments.filter((x) => x.blob.mimeType.includes("video/"));

	return (
		<div class="w-full flex flex-col gap-2">
			<Show when={imageFiles().length > 0}>
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={imageFiles()}>
						{(item) => <ImageAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
			<Show when={videoFiles().length > 0}>
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={videoFiles()}>
						{(item) => <VideoAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
			<Show when={audioFiles().length > 0}>
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={audioFiles()}>
						{(item) => <AudioAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
			<Show when={nonDisplayableFiles().length > 0}>
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={nonDisplayableFiles()}>
						{(item) => <GenericFileAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
		</div>
	);
};
