import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { DocumentTextIcon } from "@solar-icons/solid/bold/document-text";
import { FileIcon } from "@solar-icons/solid/bold/file";
import { FileZipIcon } from "@solar-icons/solid/bold/file-zip";
import { MusicNoteIcon } from "@solar-icons/solid/bold/music-note";
import { VideoFramePlayHorizontalIcon } from "@solar-icons/solid/bold/video-frame-play-horizontal";
import {
	createSignal,
	type JSX,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import {
	AnimatedPlayPauseIcon,
	AnimatedVolumeIcon,
} from "../../icons/animated/media";
import { AnimatedDownloadIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { Scrubber } from "../Media/Scrubber";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import {
	createPressRipple,
	embedSurface,
	formatBytes,
	formatClock,
	pressSurface,
} from "./shared";

export type FileKind = "generic" | "pdf" | "audio" | "video" | "archive";

const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv"]);

export const fileKindOf = (name: string, mimeType?: string): FileKind => {
	const extension = name.split(".").pop()?.toLowerCase() ?? "";
	if (mimeType === "application/pdf" || extension === "pdf") return "pdf";
	if (mimeType?.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension))
		return "audio";
	if (mimeType?.startsWith("video/") || VIDEO_EXTENSIONS.has(extension))
		return "video";
	if (ARCHIVE_EXTENSIONS.has(extension)) return "archive";
	return "generic";
};

const KIND_ICON: Record<FileKind, () => JSX.Element> = {
	generic: () => <FileIcon />,
	pdf: () => <DocumentTextIcon />,
	audio: () => <MusicNoteIcon />,
	video: () => <VideoFramePlayHorizontalIcon />,
	archive: () => <FileZipIcon />,
};

const KIND_LABEL: Record<FileKind, string> = {
	generic: "File",
	pdf: "PDF",
	audio: "Audio",
	video: "Video",
	archive: "Archive",
};

const KIND_TINT: Record<FileKind, string> = {
	generic: "bg-accent text-foreground",
	pdf: "bg-destructive/15 text-destructive",
	audio: "bg-primary/20 text-primary-highlight",
	video: "bg-info/15 text-info",
	archive: "bg-warning/15 text-warning",
};

const cardClass = "flex w-full max-w-[416px] gap-3 p-3";

const KindTile = (props: { kind: FileKind }) => (
	<span
		aria-hidden="true"
		class={cx(
			"flex size-12 shrink-0 items-center justify-center rounded-badge [&>svg]:size-6",
			KIND_TINT[props.kind],
		)}
	>
		{KIND_ICON[props.kind]()}
	</span>
);

const ProgressBar = (props: {
	value: number;
	name: string;
	class?: string;
}) => (
	<span
		role="progressbar"
		aria-label={`Uploading ${props.name}`}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(props.value * 100)}
		class={cx(
			"block h-1 overflow-hidden rounded-full bg-foreground/10",
			props.class,
		)}
	>
		<span
			class="block h-full rounded-full bg-primary transition-[width] duration-[calc(150ms*var(--motion-scale))] motion-reduce:transition-none"
			style={{ width: `${Math.min(1, Math.max(0, props.value)) * 100}%` }}
		/>
	</span>
);

export type FileAttachmentProps = {
	name: string;
	size: number;
	kind?: FileKind;
	mimeType?: string;
	href?: string;
	progress?: number;
	onCancel?: () => void;
	class?: string;
};

export const FileAttachment = (props: FileAttachmentProps) => {
	const press = createPressRipple();
	const kind = () => props.kind ?? fileKindOf(props.name, props.mimeType);
	const uploading = () => props.progress !== undefined && props.progress < 1;
	const interactive = () => !uploading() && !!props.href;
	const meta = () => `${KIND_LABEL[kind()]} · ${formatBytes(props.size)}`;

	return (
		<Dynamic
			component={interactive() ? "a" : "div"}
			ref={(element: HTMLElement) => {
				if (interactive()) press(element);
			}}
			href={interactive() ? props.href : undefined}
			download={interactive() ? props.name : undefined}
			data-file-attachment=""
			data-icon-host={interactive() ? "" : undefined}
			class={cx(
				embedSurface,
				cardClass,
				"items-center no-underline",
				interactive() && cx(pressSurface, "hover:bg-popover"),
				props.class,
			)}
		>
			<KindTile kind={kind()} />
			<span class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="truncate text-sm font-semibold" title={props.name}>
					{props.name}
				</span>
				<Show
					when={uploading()}
					fallback={<span class="text-xs text-muted-foreground">{meta()}</span>}
				>
					<span class="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
						<ProgressBar
							value={props.progress ?? 0}
							name={props.name}
							class="flex-1"
						/>
						{Math.round((props.progress ?? 0) * 100)}%
					</span>
				</Show>
			</span>
			<Switch>
				<Match when={uploading() && props.onCancel}>
					<button
						type="button"
						aria-label={`Cancel upload of ${props.name}`}
						onClick={() => props.onCancel?.()}
						class="pressable focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border-0 bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground [&>svg]:size-5"
					>
						<CloseCircleIcon />
					</button>
				</Match>
				<Match when={interactive()}>
					<span
						aria-hidden="true"
						class="flex size-8 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
					>
						<AnimatedDownloadIcon />
					</span>
				</Match>
			</Switch>
		</Dynamic>
	);
};

export type AudioAttachmentProps = {
	name: string;
	size: number;
	src?: string;
	duration?: number;
	href?: string;
	class?: string;
};

export const AudioAttachment = (props: AudioAttachmentProps) => {
	const [playing, setPlaying] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	const [position, setPosition] = createSignal(0);
	const [duration, setDuration] = createSignal(props.duration ?? 0);
	const [buffered, setBuffered] = createSignal<[number, number][]>([]);
	let audio: HTMLAudioElement | undefined;

	onCleanup(() => audio?.pause());

	const togglePlay = () => {
		if (!audio || !props.src) {
			setPlaying(!playing());
			return;
		}
		if (audio.paused) {
			setPlaying(true);
			audio.play().catch(() => setPlaying(false));
		} else {
			audio.pause();
		}
	};

	const toggleMute = () => {
		const next = !muted();
		setMuted(next);
		if (audio) audio.muted = next;
	};

	const seek = (value: number) => {
		setPosition(value);
		if (audio && Number.isFinite(value)) audio.currentTime = value;
	};

	const meta = () => `${KIND_LABEL.audio} · ${formatBytes(props.size)}`;

	return (
		<div
			data-audio-attachment=""
			class={cx(
				embedSurface,
				"flex w-full max-w-[416px] flex-col gap-3 p-3",
				props.class,
			)}
		>
			<Show when={props.src}>
				<audio
					ref={audio}
					src={props.src}
					preload="metadata"
					class="hidden"
					onPlay={() => setPlaying(true)}
					onPause={() => setPlaying(false)}
					onEnded={() => {
						setPlaying(false);
						setPosition(0);
					}}
					onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
					onProgress={(event) => {
						const ranges: [number, number][] = [];
						const media = event.currentTarget.buffered;
						for (let index = 0; index < media.length; index += 1)
							ranges.push([media.start(index), media.end(index)]);
						setBuffered(ranges);
					}}
					onLoadedMetadata={(event) => {
						if (Number.isFinite(event.currentTarget.duration))
							setDuration(event.currentTarget.duration);
					}}
				/>
			</Show>
			<div class="flex items-center gap-3">
				<KindTile kind="audio" />
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<span class="truncate text-sm font-semibold" title={props.name}>
						{props.name}
					</span>
					<span class="text-xs text-muted-foreground">{meta()}</span>
				</div>
				<Show when={props.href}>
					{(href) => (
						<a
							href={href()}
							download={props.name}
							aria-label={`Download ${props.name}`}
							data-icon-host=""
							class="pressable focus-ring flex size-8 shrink-0 items-center justify-center rounded-control-sm text-muted-foreground hover:bg-secondary hover:text-foreground [&>svg]:size-5"
						>
							<AnimatedDownloadIcon />
						</a>
					)}
				</Show>
			</div>
			<div class="flex items-center gap-2 rounded-badge bg-secondary p-1.5">
				<button
					type="button"
					data-icon-host=""
					aria-pressed={playing()}
					aria-label={playing() ? `Pause ${props.name}` : `Play ${props.name}`}
					onClick={togglePlay}
					class="pressable focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-primary-fill text-white hover:bg-primary-fill-highlight"
				>
					<AnimatedPlayPauseIcon playing={playing()} size={16} />
				</button>
				<Scrubber
					label={`Seek ${props.name}`}
					value={position()}
					max={duration()}
					buffered={buffered()}
					class="min-w-0 flex-1"
					onSeek={seek}
				/>
				<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
					{formatClock(position())} / {formatClock(duration())}
				</span>
				<button
					type="button"
					data-icon-host=""
					aria-pressed={muted()}
					aria-label={muted() ? `Unmute ${props.name}` : `Mute ${props.name}`}
					onClick={toggleMute}
					class="pressable focus-ring flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border-0 bg-transparent text-muted-foreground hover:bg-secondary-highlight hover:text-foreground"
				>
					<AnimatedVolumeIcon level={muted() ? "off" : "high"} size={20} />
				</button>
			</div>
		</div>
	);
};

export type FileAttachmentSkeletonProps = {
	class?: string;
};

export const FileAttachmentSkeleton = (props: FileAttachmentSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx(embedSurface, cardClass, "items-center", props.class)}
	>
		<Skeleton width={48} height={48} class="shrink-0 rounded-badge" />
		<span class="flex min-w-0 flex-1 flex-col gap-1">
			<SkeletonText size="sm" width="60%" />
			<SkeletonText size="xs" width="35%" />
		</span>
		<Skeleton width={32} height={32} class="shrink-0 rounded-control-sm" />
	</div>
);
