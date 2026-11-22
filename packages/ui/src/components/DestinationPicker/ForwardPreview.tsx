import { FileIcon } from "@solar-icons/solid/bold/file";
import { GalleryMinimalisticIcon } from "@solar-icons/solid/bold/gallery-minimalistic";
import { MusicNoteIcon } from "@solar-icons/solid/bold/music-note";
import { VideocameraIcon } from "@solar-icons/solid/bold/videocamera";
import { createMemo, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { formatMessageTime, type TimeInput } from "../../utils/time";
import { Avatar } from "../Avatar/Avatar";

export type ForwardPreviewAttachmentKind =
	| "image"
	| "gif"
	| "video"
	| "audio"
	| "file";

export type ForwardPreviewAttachment = {
	kind: ForwardPreviewAttachmentKind;
	src?: string;
	alt?: string;
	spoiler?: boolean;
};

const NOUNS: Record<ForwardPreviewAttachmentKind, [string, string]> = {
	image: ["image", "images"],
	gif: ["GIF", "GIFs"],
	video: ["video", "videos"],
	audio: ["audio file", "audio files"],
	file: ["file", "files"],
};

const ORDER: ForwardPreviewAttachmentKind[] = [
	"image",
	"gif",
	"video",
	"audio",
	"file",
];

export const summarizeForwardAttachments = (
	attachments: readonly Pick<ForwardPreviewAttachment, "kind">[],
) =>
	ORDER.flatMap((kind) => {
		const count = attachments.filter((entry) => entry.kind === kind).length;
		if (count === 0) return [];
		const [one, many] = NOUNS[kind];
		return [`${count} ${count === 1 ? one : many}`];
	}).join(" · ");

const thumbnailOf = (attachments: readonly ForwardPreviewAttachment[]) =>
	attachments.find(
		(entry) => (entry.kind === "image" || entry.kind === "gif") && entry.src,
	);

const SummaryIcon = (props: { kind: ForwardPreviewAttachmentKind }) => (
	<Switch fallback={<FileIcon />}>
		<Match when={props.kind === "image" || props.kind === "gif"}>
			<GalleryMinimalisticIcon />
		</Match>
		<Match when={props.kind === "video"}>
			<VideocameraIcon />
		</Match>
		<Match when={props.kind === "audio"}>
			<MusicNoteIcon />
		</Match>
	</Switch>
);

export type ForwardPreviewProps = {
	author: string;
	avatarSrc?: string;
	seed?: string;
	timestamp?: TimeInput;
	now?: TimeInput;
	attachments?: readonly ForwardPreviewAttachment[];
	children?: JSX.Element;
	class?: string;
};

export const ForwardPreview = (props: ForwardPreviewProps) => {
	const text = createSlot(() => props.children);
	const attachments = () => props.attachments ?? [];
	const summary = createMemo(() => summarizeForwardAttachments(attachments()));
	const thumbnail = createMemo(() => thumbnailOf(attachments()));

	return (
		<figure
			data-forward-preview=""
			class={cx(
				"m-0 flex min-w-0 items-stretch gap-3 rounded-control bg-secondary p-3",
				props.class,
			)}
		>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<figcaption class="flex h-5 min-w-0 items-center gap-1.5">
					<Avatar
						name={props.author}
						src={props.avatarSrc}
						seed={props.seed}
						size="xs"
						aria-hidden="true"
					/>
					<span class="flex min-w-0 items-baseline gap-1.5">
						<span
							data-forward-preview-author=""
							class="min-w-0 truncate text-sm leading-5 font-semibold text-foreground"
						>
							{props.author}
						</span>
						<Show when={props.timestamp}>
							{(timestamp) => (
								<time class="shrink-0 text-xs leading-5 whitespace-nowrap text-muted-foreground">
									{formatMessageTime(timestamp(), props.now)}
								</time>
							)}
						</Show>
					</span>
				</figcaption>
				<Show when={text.has()}>
					<div
						data-forward-preview-text=""
						class="pointer-events-none m-0 line-clamp-2 text-sm leading-5 text-foreground [overflow-wrap:anywhere]"
					>
						{text()}
					</div>
				</Show>
				<Show when={summary()}>
					<span
						data-forward-preview-summary=""
						class="mt-auto flex h-4 min-w-0 items-center gap-1 pt-1 text-xs leading-4 font-medium text-muted-foreground box-content"
					>
						<span
							aria-hidden="true"
							class="flex size-3.5 shrink-0 [&>svg]:size-3.5"
						>
							<SummaryIcon kind={attachments()[0]?.kind ?? "file"} />
						</span>
						<span class="min-w-0 truncate">{summary()}</span>
					</span>
				</Show>
			</div>
			<Show when={thumbnail()}>
				{(image) => (
					<span
						data-forward-preview-thumbnail=""
						class="relative flex size-12 shrink-0 self-start overflow-hidden rounded-control-sm bg-muted"
					>
						<img
							src={image().src}
							alt={image().alt ?? ""}
							draggable={false}
							decoding="async"
							class={cx(
								"size-full object-cover outline-1 -outline-offset-1 outline-white/8 light:outline-black/8",
								image().spoiler && "blur-md",
							)}
						/>
					</span>
				)}
			</Show>
		</figure>
	);
};
