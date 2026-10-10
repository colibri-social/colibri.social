import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { PlayIcon } from "@solar-icons/solid/bold/play";
import {
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import {
	AnimatedPlayPauseIcon,
	AnimatedVolumeIcon,
	type VolumeLevel,
} from "../../icons/animated/media";
import { AnimatedMaximizeIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { motionScale } from "../../utils/motion";
import { Spinner } from "../Spinner/Spinner";
import { formatClock } from "./format";
import {
	claimPlayback,
	onPlaybackHandoff,
	releasePlayback,
	stashPlayback,
} from "./handoff";
import { Scrubber } from "./Scrubber";

export type VideoPlayerHandle = {
	currentTime: () => number;
	playing: () => boolean;
	play: () => Promise<void>;
	pause: () => void;
	seek: (time: number) => void;
	element: () => HTMLVideoElement | undefined;
};

export type VideoPlayerHandoff = "inline" | "viewer";

export type VideoPlayerProps = {
	src: string;
	poster?: string;
	width?: number;
	height?: number;
	label?: string;
	autoPlay?: boolean;
	muted?: boolean;
	startTime?: number;
	fit?: "contain" | "cover";
	interactive?: boolean;
	controlsHideDelay?: number;
	handoff?: VideoPlayerHandoff;
	onExpand?: () => void;
	onTimeUpdate?: (time: number) => void;
	onPlayingChange?: (playing: boolean) => void;
	onStartedChange?: (started: boolean) => void;
	onReady?: (video: HTMLVideoElement) => void;
	ref?: (handle: VideoPlayerHandle) => void;
	class?: string;
	style?: JSX.CSSProperties;
};

type FullscreenVideo = HTMLVideoElement & {
	webkitEnterFullscreen?: () => void;
	webkitDisplayingFullscreen?: boolean;
};

const HIDE_DELAY_MS = 2500;
const SEEK_STEP = 5;
const JUMP_STEP = 10;

const matches = (query: string) =>
	typeof window !== "undefined" && !!window.matchMedia?.(query).matches;

const fadeClass =
	"transition-opacity duration-[calc(160ms*var(--motion-scale))] ease-out motion-reduce:transition-none reduced-motion:transition-none";

const controlButton =
	"pressable flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border-0 bg-transparent p-0 text-white outline-none hover:bg-white/15 focus-ring [&_svg]:size-5";

const bufferedRanges = (video: HTMLVideoElement): [number, number][] => {
	const ranges: [number, number][] = [];
	for (let index = 0; index < video.buffered.length; index += 1)
		ranges.push([video.buffered.start(index), video.buffered.end(index)]);
	return ranges;
};

export const VideoPlayer = (props: VideoPlayerProps) => {
	const [playing, setPlaying] = createSignal(false);
	const [started, setStarted] = createSignal(false);
	const [time, setTime] = createSignal(props.startTime ?? 0);
	const [duration, setDuration] = createSignal(0);
	const [buffered, setBuffered] = createSignal<[number, number][]>([]);
	const [waiting, setWaiting] = createSignal(false);
	const [failed, setFailed] = createSignal(false);
	const [muted, setMuted] = createSignal(!!props.muted);
	const [volume, setVolume] = createSignal(1);
	const [controls, setControls] = createSignal(true);
	const [scrubbing, setScrubbing] = createSignal(false);
	const [fullscreen, setFullscreen] = createSignal(false);
	const [fineHover] = createSignal(
		matches("(hover: hover) and (pointer: fine)"),
	);

	let root: HTMLElement | undefined;
	let video: FullscreenVideo | undefined;
	let surface: HTMLDivElement | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let fixingDuration = false;
	let resumeAfterScrub = false;
	let pendingStart = props.startTime ?? 0;
	let pendingPlay = !!props.autoPlay;

	const interactive = () => props.interactive !== false;
	const label = () => props.label ?? "Video";
	const volumeLevel = (): VolumeLevel => {
		if (muted() || volume() === 0) return "off";
		return volume() < 0.5 ? "low" : "high";
	};

	const clearHide = () => clearTimeout(hideTimer);

	const scheduleHide = () => {
		clearHide();
		if (!playing() || scrubbing()) return;
		hideTimer = setTimeout(
			() => {
				if (!playing() || scrubbing()) return;
				if (root?.querySelector("[data-video-controls]:focus-within")) return;
				setControls(false);
			},
			(props.controlsHideDelay ?? HIDE_DELAY_MS) * motionScale(),
		);
	};

	const reveal = () => {
		setControls(true);
		scheduleHide();
	};

	const play = async () => {
		if (!video) return;
		try {
			await video.play();
		} catch {
			setPlaying(false);
		}
	};

	const pause = () => video?.pause();

	const toggle = () => {
		if (!video || failed()) return;
		if (video.paused || video.ended) void play();
		else pause();
	};

	const seek = (next: number) => {
		if (!video) return;
		const bounded = Math.min(Math.max(next, 0), duration() || next);
		video.currentTime = bounded;
		setTime(bounded);
	};

	const toggleMute = () => {
		if (!video) return;
		const next = !video.muted;
		video.muted = next;
		if (!next && video.volume === 0) video.volume = 1;
	};

	const toggleFullscreen = async () => {
		if (props.onExpand) {
			props.onExpand();
			return;
		}
		if (!root || !video) return;
		if (document.fullscreenElement) {
			await document.exitFullscreen().catch(() => {});
			return;
		}
		if (root.requestFullscreen) {
			await root.requestFullscreen().catch(() => {
				video?.webkitEnterFullscreen?.();
			});
			return;
		}
		video.webkitEnterFullscreen?.();
	};

	const handle: VideoPlayerHandle = {
		currentTime: () => video?.currentTime ?? time(),
		playing,
		play,
		pause,
		seek,
		element: () => video,
	};

	createEffect(
		on(playing, (isPlaying) => {
			props.onPlayingChange?.(isPlaying);
			if (isPlaying) scheduleHide();
			else {
				clearHide();
				setControls(true);
			}
		}),
	);

	createEffect(
		on(started, (value) => props.onStartedChange?.(value), { defer: true }),
	);

	createEffect(
		on(
			() => props.src,
			() => {
				setFailed(false);
				setStarted(false);
				setDuration(0);
				setBuffered([]);
			},
			{ defer: true },
		),
	);

	const applyStart = () => {
		if (!video) return;
		if (pendingStart > 0) {
			video.currentTime = pendingStart;
			setTime(pendingStart);
		}
		pendingStart = 0;
		if (pendingPlay) {
			pendingPlay = false;
			void play();
		}
	};

	const onLoadedMetadata = () => {
		if (!video) return;
		if (video.duration === Number.POSITIVE_INFINITY) {
			fixingDuration = true;
			video.currentTime = Number.MAX_SAFE_INTEGER;
			return;
		}
		setDuration(video.duration || 0);
		props.onReady?.(video);
		applyStart();
	};

	const onDurationChange = () => {
		if (!video) return;
		if (!Number.isFinite(video.duration)) return;
		setDuration(video.duration);
		if (fixingDuration) {
			fixingDuration = false;
			video.currentTime = 0;
			props.onReady?.(video);
			applyStart();
		}
	};

	const onTimeUpdate = () => {
		if (!video || fixingDuration || scrubbing()) return;
		setTime(video.currentTime);
		props.onTimeUpdate?.(video.currentTime);
	};

	const onFullscreenChange = () =>
		setFullscreen(document.fullscreenElement === root);

	const onSurfaceClick = (event: MouseEvent) => {
		if (!interactive() || failed()) return;
		if ((event.target as Element).closest("[data-video-controls]")) return;
		const touch =
			(event as PointerEvent).pointerType === "touch" ||
			(event as PointerEvent).pointerType === "pen";
		if (touch && playing() && !controls()) {
			reveal();
			return;
		}
		toggle();
		reveal();
	};

	const onKeyDown: JSX.EventHandler<HTMLElement, KeyboardEvent> = (event) => {
		if (!interactive() || !video) return;
		const target = event.target as Element;
		const onControl =
			target !== root && !!target.closest("button, a, [role='slider']");
		const key = event.key.toLowerCase();
		const now = video.currentTime;
		const actions: Record<string, () => void> = {
			k: toggle,
			j: () => seek(now - JUMP_STEP),
			l: () => seek(now + JUMP_STEP),
			arrowleft: () => seek(now - SEEK_STEP),
			arrowright: () => seek(now + SEEK_STEP),
			m: toggleMute,
			f: () => void toggleFullscreen(),
		};
		if (key === " " && !onControl) actions[" "] = toggle;
		const action = actions[key];
		if (!action) return;
		if (onControl && (key === "arrowleft" || key === "arrowright")) return;
		event.preventDefault();
		event.stopPropagation();
		action();
		reveal();
	};

	onMount(() => {
		props.ref?.(handle);
		surface?.addEventListener("click", onSurfaceClick);
		document.addEventListener("fullscreenchange", onFullscreenChange);
		const key = props.src;
		if (props.handoff === "viewer") {
			const state = claimPlayback(key);
			if (state) {
				pendingStart = state.time;
				pendingPlay = state.playing;
				setTime(state.time);
			}
		}
		const unsubscribe =
			props.handoff === "inline"
				? onPlaybackHandoff(key, (event) => {
						if (!video) return;
						if (event.kind === "claim") {
							video.pause();
							return;
						}
						seek(event.time);
						if (event.playing) void play();
					})
				: undefined;
		if (video && video.readyState >= 1) onLoadedMetadata();
		onCleanup(() => {
			unsubscribe?.();
			surface?.removeEventListener("click", onSurfaceClick);
			document.removeEventListener("fullscreenchange", onFullscreenChange);
			clearHide();
			if (props.handoff === "viewer" && video)
				releasePlayback(key, {
					time: video.currentTime,
					playing: !video.paused && !video.ended,
				});
			video?.pause();
		});
	});

	const expand = () => {
		if (props.handoff === "inline" && video) {
			stashPlayback(props.src, {
				time: video.currentTime,
				playing: !video.paused && !video.ended,
			});
			video.pause();
		}
		void toggleFullscreen();
	};

	const aspect = () =>
		props.width && props.height
			? `${props.width} / ${props.height}`
			: undefined;

	const showControls = () => interactive() && (controls() || !playing());

	return (
		<section
			ref={root}
			aria-label={`Video player: ${label()}`}
			tabindex={interactive() ? 0 : -1}
			data-video-player=""
			data-playing={playing() || undefined}
			data-started={started() || undefined}
			data-controls={showControls() ? "visible" : "hidden"}
			data-fullscreen={fullscreen() || undefined}
			class={cx(
				"group/video relative isolate overflow-hidden bg-black text-white outline-none",
				"focus-ring-inset",
				playing() && !showControls() && "cursor-none",
				props.class,
			)}
			style={{ "aspect-ratio": aspect(), ...props.style }}
			onKeyDown={onKeyDown}
			onPointerMove={(event) => {
				if (event.pointerType === "mouse" && interactive()) reveal();
			}}
			onFocusIn={() => interactive() && reveal()}
		>
			<div
				ref={surface}
				data-video-surface=""
				class={cx("absolute inset-0", interactive() && "cursor-pointer")}
			>
				<video
					ref={video}
					src={props.src}
					poster={props.poster}
					muted={props.muted}
					playsinline
					preload="metadata"
					aria-label={label()}
					class={cx(
						"block size-full",
						props.fit === "cover" ? "object-cover" : "object-contain",
					)}
					onLoadedMetadata={onLoadedMetadata}
					onDurationChange={onDurationChange}
					onTimeUpdate={onTimeUpdate}
					onProgress={(event) =>
						setBuffered(bufferedRanges(event.currentTarget))
					}
					onPlay={() => {
						setPlaying(true);
						setStarted(true);
					}}
					onPause={() => setPlaying(false)}
					onEnded={() => setPlaying(false)}
					onWaiting={() => setWaiting(true)}
					onPlaying={() => setWaiting(false)}
					onCanPlay={() => setWaiting(false)}
					onSeeked={() => setWaiting(false)}
					onError={() => {
						setFailed(true);
						setWaiting(false);
						if (video) props.onReady?.(video);
					}}
					onVolumeChange={(event) => {
						setMuted(event.currentTarget.muted);
						setVolume(event.currentTarget.volume);
					}}
				/>
			</div>
			<Show when={!playing() && !failed() && !waiting()}>
				<span
					aria-hidden="true"
					data-video-badge=""
					class="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<span class="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm [&>svg]:size-6">
						<PlayIcon />
					</span>
				</span>
			</Show>
			<Show when={waiting() && !failed()}>
				<span
					data-video-buffering=""
					class="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<span class="flex size-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm">
						<Spinner size={24} label="Loading video" />
					</span>
				</span>
			</Show>
			<Show when={failed()}>
				<div
					role="alert"
					data-video-error=""
					class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4 text-center"
				>
					<span class="text-white/70 [&>svg]:size-6">
						<DangerTriangleIcon />
					</span>
					<span class="text-sm font-semibold">This video can't be played</span>
					<button
						type="button"
						class="cursor-pointer rounded-control-xs border-0 bg-transparent px-1 py-0.5 text-sm font-semibold text-white/80 underline-offset-2 outline-none hover:text-white hover:underline focus-ring"
						onClick={() => {
							setFailed(false);
							video?.load();
						}}
					>
						Try again
					</button>
				</div>
			</Show>
			<Show when={interactive() && !failed()}>
				<div
					data-video-controls=""
					inert={!showControls()}
					class={cx(
						"absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-black/75 via-black/40 to-transparent px-2 pt-8 pb-1.5",
						fullscreen() && "px-safe-offset-3 pb-safe-offset-2",
						fadeClass,
						showControls() ? "opacity-100" : "pointer-events-none opacity-0",
					)}
				>
					<Scrubber
						tone="overlay"
						label={`Seek ${label()}`}
						value={time()}
						max={duration()}
						buffered={buffered()}
						class="mx-1"
						onSeekStart={() => {
							setScrubbing(true);
							clearHide();
							resumeAfterScrub = playing();
							if (resumeAfterScrub) video?.pause();
						}}
						onSeek={(next) => {
							setTime(next);
							if (video) video.currentTime = next;
						}}
						onSeekEnd={(next) => {
							seek(next);
							setScrubbing(false);
							if (resumeAfterScrub) void play();
							resumeAfterScrub = false;
							scheduleHide();
						}}
					/>
					<div class="flex items-center gap-1">
						<button
							type="button"
							data-icon-host=""
							aria-pressed={playing()}
							aria-label={playing() ? "Pause" : "Play"}
							class={controlButton}
							onClick={toggle}
						>
							<AnimatedPlayPauseIcon playing={playing()} />
						</button>
						<span class="px-1 text-xs font-semibold whitespace-nowrap text-white/90 tabular-nums">
							{formatClock(time())} / {formatClock(duration())}
						</span>
						<span class="flex-1" />
						<div class="group/volume flex items-center">
							<Show when={fineHover()}>
								<div
									data-video-volume=""
									class={cx(
										"ring-room-y w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-[calc(160ms*var(--motion-scale))] ease-out motion-reduce:transition-none reduced-motion:transition-none",
										"group-focus-within/volume:w-16 group-focus-within/volume:opacity-100 group-hover/volume:w-16 group-hover/volume:opacity-100",
									)}
								>
									<Scrubber
										tone="overlay"
										label="Volume"
										value={muted() ? 0 : volume()}
										max={1}
										step={0.1}
										formatTime={(value) => `${Math.round(value * 100)}%`}
										valueText={(value) => `${Math.round(value * 100)}%`}
										class="mx-1.5"
										onSeek={(next) => {
											if (!video) return;
											video.volume = next;
											video.muted = next === 0;
										}}
									/>
								</div>
							</Show>
							<button
								type="button"
								data-icon-host=""
								aria-pressed={muted()}
								aria-label={muted() ? "Unmute" : "Mute"}
								class={controlButton}
								onClick={toggleMute}
							>
								<AnimatedVolumeIcon level={volumeLevel()} />
							</button>
						</div>
						<button
							type="button"
							data-icon-host=""
							aria-label={
								props.onExpand
									? "Expand video"
									: fullscreen()
										? "Exit fullscreen"
										: "Fullscreen"
							}
							class={controlButton}
							onClick={expand}
						>
							<AnimatedMaximizeIcon />
						</button>
					</div>
				</div>
			</Show>
		</section>
	);
};
