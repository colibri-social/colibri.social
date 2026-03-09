import { APPVIEW_DOMAIN } from "astro:env/client";
import { type Component, For, Match, Show, Switch } from "solid-js";
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
import { File } from "../../icons/File";

export const MessageAttachments: Component<{
	did: string;
	attachments: Array<AttachmentObj>;
	disableHover?: boolean;
}> = (props) => {
	const [, { notifyEmbedLoad }] = useMessageContext();
	const nonDisplayableFiles = () =>
		props.attachments.filter(
			(x) =>
				!x.blob.mimeType.includes("image/") &&
				!x.blob.mimeType.includes("video/") &&
				!x.blob.mimeType.includes("audio/"),
		);

	const audioFiles = () =>
		props.attachments.filter((x) => x.blob.mimeType.includes("audio/"));

	const imageAndVideoFiles = () =>
		props.attachments.filter(
			(x) =>
				x.blob.mimeType.includes("image/") ||
				x.blob.mimeType.includes("video/"),
		);

	return (
		<div class="w-full flex flex-col gap-2">
			<Show when={imageAndVideoFiles().length > 0}>
				{/* Images & Videos */}
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={imageAndVideoFiles()}>
						{(item) => (
							<Switch>
								<Match when={item.blob.mimeType.includes("image/")}>
									<Lightbox
										src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${item.blob.ref.$link}`}
									>
										<img
											src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${item.blob.ref.$link}`}
											class="max-h-52 max-w-96 object-cover rounded-sm"
											classList={{
												"hover:bg-muted/50 cursor-pointer": !props.disableHover,
											}}
											alt={item.name ?? ""}
											onLoad={notifyEmbedLoad}
										/>
									</Lightbox>
								</Match>
								<Match when={item.blob.mimeType.includes("video/")}>
									<media-player
										class="max-h-96 max-w-[416px] rounded-sm"
										title={item.name ?? "Video"}
										load="eager"
										viewType="video"
										storage={item.blob.ref.$link}
										streamType="on-demand"
										onCanPlay={notifyEmbedLoad}
									>
										<media-provider>
											<source
												src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${item.blob.ref.$link}`}
												type={item.blob.mimeType}
											/>
										</media-provider>
										<media-video-layout />
									</media-player>
								</Match>
							</Switch>
						)}
					</For>
				</div>
			</Show>
			<Show when={audioFiles().length > 0}>
				{/* Audio Files */}
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={audioFiles()}>
						{(item) => (
							<media-player
								class="max-h-96 max-w-[416px] rounded-sm"
								title={item.name ?? "Audio"}
								load="eager"
								viewType="audio"
								storage={item.blob.ref.$link}
								streamType="on-demand"
								onCanPlay={notifyEmbedLoad}
							>
								<media-provider>
									<source
										src={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${item.blob.ref.$link}`}
										type={item.blob.mimeType}
									/>
								</media-provider>
								<media-audio-layout />
							</media-player>
						)}
					</For>
				</div>
			</Show>
			<Show when={nonDisplayableFiles().length > 0}>
				{/* Other Files */}
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={nonDisplayableFiles()}>
						{(item) => (
							<a
								class="flex flex-row gap-2 items-center border border-border rounded-sm w-[416px] p-2 hover:bg-card"
								href={`https://${APPVIEW_DOMAIN}/api/blob?did=${props.did}&cid=${item.blob.ref.$link}`}
								target="_blank"
							>
								<File className="min-w-10 w-10 h-10" />
								<div class="flex flex-col w-full">
									<span class="text-ellipsis w-[calc(100%-3rem)] text-nowrap overflow-hidden">
										{item.name ?? item.blob.ref.$link}
									</span>
									<span class="text-sm text-muted-foreground">
										{item.blob.mimeType}
									</span>
								</div>
							</a>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
};
