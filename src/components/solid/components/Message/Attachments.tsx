import { APPVIEW_DOMAIN } from "astro:env/client";
import { type Component, For, Show } from "solid-js";
import type { AttachmentObj } from "../../contexts/GlobalContext/events";
import { useMessageContext } from "../../contexts/MessageContext";
import { Lightbox } from "../Lightbox";
import "vidstack/bundle";
import "vidstack/player";
import "vidstack/player/layouts";
import "vidstack/player/ui";

import "vidstack/player/styles/default/theme.css";
import "vidstack/player/styles/default/layouts/video.css";
import "vidstack/player/styles/default/layouts/audio.css";
import { Icon } from "@/components/solid/icons/Icon";

type AttachmentComponent = Component<{ item: AttachmentObj; did: string }>;

export const AudioAttachment: AttachmentComponent = (props) => {
	const [, { notifyEmbedLoad }] = useMessageContext();

	return (
		<media-player
			class="max-h-96 max-w-104 rounded-sm"
			title={props.item.name ?? "Audio"}
			load="eager"
			viewType="audio"
			storage={props.item.blob.ref.$link}
			streamType="on-demand"
			onCanPlay={notifyEmbedLoad}
		>
			<media-provider>
				<source
					src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${props.item.blob.ref.$link}`}
					type={props.item.blob.mimeType}
				/>
			</media-provider>
			<media-audio-layout />
		</media-player>
	);
};

export const ImageAttachment: AttachmentComponent = (props) => {
	const [, { notifyEmbedLoad }] = useMessageContext();

	return (
		<Lightbox
			src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${props.item.blob.ref.$link}`}
		>
			<img
				src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${props.item.blob.ref.$link}`}
				class="max-h-52 max-w-96 object-cover rounded-sm"
				alt={props.item.name ?? ""}
				onLoad={notifyEmbedLoad}
			/>
		</Lightbox>
	);
};

export const VideoAttachment: AttachmentComponent = (props) => {
	const [, { notifyEmbedLoad }] = useMessageContext();

	return (
		<media-player
			class="max-h-96 max-w-104 rounded-sm"
			title={props.item.name ?? "Video"}
			load="eager"
			viewType="video"
			storage={props.item.blob.ref.$link}
			streamType="on-demand"
			onCanPlay={notifyEmbedLoad}
		>
			<media-provider>
				<source
					src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${props.item.blob.ref.$link}`}
					type={props.item.blob.mimeType}
				/>
			</media-provider>
			<media-video-layout />
		</media-player>
	);
};

export const GenericFileAttachment: AttachmentComponent = (props) => {
	return (
		<a
			class="flex flex-row gap-2 items-center border border-border rounded-sm w-104 p-2 hover:bg-card"
			href={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${props.item.blob.ref.$link}`}
			target="_blank"
			rel="noreferrer"
		>
			<Icon variant="regular" name="file-icon" class="min-w-10 w-10 h-10" />
			<div class="flex flex-col w-full">
				<span class="text-ellipsis w-[calc(100%-3rem)] text-nowrap overflow-hidden">
					{props.item.name ?? props.item.blob.ref.$link}
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
	attachments: Array<AttachmentObj>;
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
						{(item) => <ImageAttachment item={item} did={props.did} />}
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
