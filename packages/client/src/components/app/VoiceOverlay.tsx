import type { ActorData } from "@colibri-social/lib";
import { useNavigate, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import MonitorXIcon from "~icons/lucide/monitor-x";
import ArrowLeftIcon from "~icons/ph/arrow-left";
import PhoneSlashFillIcon from "~icons/ph/phone-slash-fill";
import VideoCameraSlashFillIcon from "~icons/ph/video-camera-slash-fill";
import XIcon from "~icons/ph/x";
import {
	communityUriToUrlCompatible,
	urlSegmentToUri,
} from "../../atproto/community-uri-to-url-compatible";
import { useActorCache } from "../../contexts/ActorCache";
import { useUserContext } from "../../contexts/User";
import { ConnectionState, useVoiceChatContext } from "../../contexts/VoiceChat";
import { useIsMobile } from "../../utils/mobile-pane";
import { readSafeAreaInsets } from "../../utils/safe-area";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../ui/Tooltip";
import { DEFAULT_BANNER } from "./profile/theme";
import User from "./user";
import { displayableNameFn } from "./user/DisplayableName";
import { VideoTile } from "./VoiceChannelView";

type Corner = "tl" | "tr" | "bl" | "br";

const MARGIN = 16;
const MIN_W = 220;
const MAX_W = 560;
const CORNER_KEY = "colibri:voice-overlay-corner";
const WIDTH_KEY = "colibri:voice-overlay-width";

const clamp = (v: number, lo: number, hi: number): number =>
	Math.max(lo, Math.min(hi, v));

const loadCorner = (): Corner => {
	const raw = localStorage.getItem(CORNER_KEY);
	return raw === "tl" || raw === "tr" || raw === "bl" || raw === "br"
		? raw
		: "br";
};

const loadWidth = (): number => {
	const raw = Number(localStorage.getItem(WIDTH_KEY));
	return Number.isFinite(raw) && raw > 0 ? clamp(raw, MIN_W, MAX_W) : 320;
};

const actorBackground = (actor?: ActorData): string => {
	const theme = actor?.data.theme;
	if (theme?.gradient?.primary && theme.gradient.secondary)
		return `linear-gradient(135deg, ${theme.gradient.primary}, ${theme.gradient.secondary})`;
	if (theme?.bannerColor && theme.bannerColor !== DEFAULT_BANNER)
		return theme.bannerColor;
	return DEFAULT_BANNER;
};

const parseChannel = (
	uri: string | null,
): { did: string; collection: string; rkey: string } | null => {
	if (!uri?.startsWith("at://")) return null;
	const [did, collection, rkey] = uri.slice("at://".length).split("/");
	if (!did || !collection || !rkey) return null;
	return { did, collection, rkey };
};

export const VoiceOverlay: Component = () => {
	const user = useUserContext();
	const params = useParams();
	const navigate = useNavigate();
	const isMobile = useIsMobile();
	const { resolve } = useActorCache();
	const [
		voiceData,
		{ disconnect, toggleCamera, toggleScreen, setOverlayDismissed },
	] = useVoiceChatContext();

	const viewingCall = (): boolean => {
		const c = parseChannel(voiceData.connection.uri);

		if (!c || !params.community || !params.channel) return false;

		const viewedDid = urlSegmentToUri(params.community)
			.slice("at://".length)
			.split("/")[0];

		return viewedDid === c.did && params.channel === c.rkey;
	};

	const callRoute = (): string | null => {
		const c = parseChannel(voiceData.connection.uri);

		if (!c) return null;

		const seg = communityUriToUrlCompatible(
			`at://${c.did}/social.colibri.community/self` as never,
		);

		return `/app/c/${seg}/social.colibri.channel.voice/${c.rkey}`;
	};

	const hasVideo = (): boolean =>
		Object.keys(voiceData.videoStreams).length > 0;

	const visible = (): boolean =>
		!isMobile() &&
		voiceData.connection.state !== ConnectionState.Disconnected &&
		!voiceData.overlayDismissed &&
		hasVideo() &&
		!viewingCall();

	const cameraFor = (did: string): MediaStream | undefined =>
		Object.values(voiceData.videoStreams).find(
			(v) => v.did === did && v.source === "cam",
		)?.stream;

	const [lastSpeaker, setLastSpeaker] = createSignal(user.did);
	createEffect(() => {
		const speakers = voiceData.activeSpeakers;
		if (speakers.length) setLastSpeaker(speakers[0]);
	});

	type Subject = {
		did: string;
		stream?: MediaStream;
		isScreen: boolean;
		speaking: boolean;
	};

	const subject = createMemo<Subject>(() => {
		const key = voiceData.focusedKey;
		if (key?.startsWith("s:")) {
			const v = voiceData.videoStreams[key.slice(2)];

			if (v) {
				return {
					did: v.did,
					stream: v.stream,
					isScreen: true,
					speaking: false,
				};
			}
		} else if (key?.startsWith("p:")) {
			const did = key.slice(2);

			return {
				did,
				stream: cameraFor(did),
				isScreen: false,
				speaking: voiceData.activeSpeakers.includes(did),
			};
		}

		const speaker = voiceData.activeSpeakers[0];

		if (speaker) {
			return {
				did: speaker,
				stream: cameraFor(speaker),
				isScreen: false,
				speaking: true,
			};
		}

		const screen = Object.values(voiceData.videoStreams).find(
			(v) => v.source === "screen",
		);

		if (screen) {
			return {
				did: screen.did,
				stream: screen.stream,
				isScreen: true,
				speaking: false,
			};
		}

		const fallbackDid = lastSpeaker();

		return {
			did: fallbackDid,
			stream: cameraFor(fallbackDid),
			isScreen: false,
			speaking: false,
		};
	});

	const actor = (): ActorData | undefined => resolve(subject().did);

	const [corner, setCorner] = createSignal<Corner>(loadCorner());
	const [width, setWidth] = createSignal<number>(loadWidth());
	const height = (): number => Math.round((width() * 9) / 16);
	const [drag, setDrag] = createSignal<{ x: number; y: number } | null>(null);
	const [resizing, setResizing] = createSignal(false);
	const [vp, setVp] = createSignal({
		w: window.innerWidth,
		h: window.innerHeight,
		insets: readSafeAreaInsets(),
	});

	onMount(() => {
		const onResizeWindow = () =>
			setVp({
				w: window.innerWidth,
				h: window.innerHeight,
				insets: readSafeAreaInsets(),
			});
		window.addEventListener("resize", onResizeWindow);
		onCleanup(() => window.removeEventListener("resize", onResizeWindow));
	});

	createEffect(() => localStorage.setItem(CORNER_KEY, corner()));
	createEffect(() => localStorage.setItem(WIDTH_KEY, String(width())));

	let boxRef: HTMLDivElement | undefined;

	const restPos = (): { x: number; y: number } => {
		const { w: vw, h: vh, insets } = vp();
		const c = corner();
		const left =
			c === "tl" || c === "bl"
				? MARGIN + insets.left
				: vw - MARGIN - insets.right - width();
		const top =
			c === "tl" || c === "tr"
				? MARGIN + insets.top
				: vh - MARGIN - insets.bottom - height();
		return { x: left, y: top };
	};

	const positionStyle = (): JSX.CSSProperties => {
		const pos = drag() ?? restPos();
		return {
			width: `${width()}px`,
			height: `${height()}px`,
			left: `${pos.x}px`,
			top: `${pos.y}px`,
		};
	};

	let moveState: { px: number; py: number; x: number; y: number } | null = null;
	let moved = false;

	const onMove = (e: PointerEvent): void => {
		if (!moveState) return;
		const dx = e.clientX - moveState.px;
		const dy = e.clientY - moveState.py;

		if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

		const { w: vw, h: vh, insets } = vp();
		setDrag({
			x: clamp(moveState.x + dx, insets.left, vw - insets.right - width()),
			y: clamp(moveState.y + dy, insets.top, vh - insets.bottom - height()),
		});
	};

	const onMoveEnd = (): void => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onMoveEnd);
		document.removeEventListener("mouseleave", onMoveEnd);
		window.removeEventListener("blur", onMoveEnd);
		const d = drag();
		if (d && moved) {
			const right = d.x + width() / 2 > vp().w / 2;
			const bottom = d.y + height() / 2 > vp().h / 2;
			setCorner(`${bottom ? "b" : "t"}${right ? "r" : "l"}` as Corner);
		}
		moveState = null;
		setDrag(null);
	};

	const onBodyPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0 || !boxRef) return;

		const rect = boxRef.getBoundingClientRect();
		moveState = { px: e.clientX, py: e.clientY, x: rect.left, y: rect.top };
		moved = false;

		setDrag({ x: rect.left, y: rect.top });

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onMoveEnd);
		document.addEventListener("mouseleave", onMoveEnd);
		window.addEventListener("blur", onMoveEnd);
	};

	const onResize = (e: PointerEvent): void => {
		const c = corner();
		const rightAnchored = c === "br" || c === "tr";
		const anchorX = rightAnchored ? window.innerWidth - MARGIN : MARGIN;
		const raw = rightAnchored ? anchorX - e.clientX : e.clientX - anchorX;
		const maxByHeight = ((window.innerHeight - 2 * MARGIN) * 16) / 9;

		setWidth(
			clamp(
				raw,
				MIN_W,
				Math.min(MAX_W, window.innerWidth - 2 * MARGIN, maxByHeight),
			),
		);
	};

	const onResizeEnd = (): void => {
		window.removeEventListener("pointermove", onResize);
		window.removeEventListener("pointerup", onResizeEnd);

		setResizing(false);
	};

	const onResizePointerDown = (e: PointerEvent): void => {
		e.stopPropagation();

		if (e.button !== 0) return;

		setResizing(true);

		window.addEventListener("pointermove", onResize);
		window.addEventListener("pointerup", onResizeEnd);
	};

	onCleanup(() => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onMoveEnd);
		document.removeEventListener("mouseleave", onMoveEnd);
		window.removeEventListener("blur", onMoveEnd);
		window.removeEventListener("pointermove", onResize);
		window.removeEventListener("pointerup", onResizeEnd);
	});

	const returnToCall = (): void => {
		const route = callRoute();
		if (route) navigate(route);
	};

	const resizeCornerClass = (): string => {
		const c = corner();

		if (c === "br") return "top-0 left-0 cursor-nwse-resize";
		if (c === "bl") return "top-0 right-0 cursor-nesw-resize";
		if (c === "tr") return "bottom-0 left-0 cursor-nesw-resize";

		return "bottom-0 right-0 cursor-nwse-resize";
	};

	return (
		<Show when={visible()}>
			<Portal>
				<div
					ref={boxRef}
					class="group/ov fixed z-50 overflow-hidden rounded-lg border border-border bg-background shadow-black shadow-lg select-none cursor-pointer"
					classList={{
						"ring-2 ring-primary": subject().speaking,
						"transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]":
							!drag() && !resizing(),
					}}
					style={positionStyle()}
					onPointerDown={onBodyPointerDown}
					onDblClick={returnToCall}
					onDragStart={(e) => e.preventDefault()}
				>
					<Show
						when={subject().stream}
						fallback={
							<div
								class="w-full h-full flex items-center justify-center pointer-events-none"
								style={{ background: actorBackground(actor()) }}
							>
								<Show
									when={actor()}
									fallback={<div class="w-20 h-20 rounded-full bg-black/20" />}
								>
									<User.Avatar user={actor()!} size="large" disableState />
								</Show>
							</div>
						}
					>
						<VideoTile
							stream={subject().stream!}
							mirror={subject().did === user.did && !subject().isScreen}
							debugLabel="overlay"
						/>
					</Show>
					<Show when={subject().stream && actor()}>
						<span class="absolute bottom-2 left-2 z-10 flex flex-row items-center gap-1.5 max-w-[calc(100%-1rem)] text-xs font-medium text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
							<Show when={subject().isScreen}>
								<MonitorXIcon width={16} height={16} />
							</Show>
							<span class="truncate">{displayableNameFn(actor()!)}</span>
						</span>
					</Show>
					<div class="absolute top-0 left-0 w-full h-12 z-0 pointer-events-none bg-linear-to-b from-background from-0% via-background/60 via-45% to-transparent to-100% opacity-0 -translate-y-2 group-hover/ov:opacity-100 group-hover/ov:translate-y-0 transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)]" />
					<button
						type="button"
						onPointerDown={(e) => e.stopPropagation()}
						onClick={returnToCall}
						class="absolute top-2 left-2 z-10 flex flex-row items-center gap-1.5 max-w-[calc(100%-3rem)] text-xs font-medium text-white cursor-pointer hover:underline transition-colors drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
					>
						<ArrowLeftIcon width={16} height={16} />
						<span class="truncate">
							{voiceData.connection.channelName ?? "Voice"}
						</span>
					</button>
					<button
						type="button"
						aria-label="Hide overlay"
						onPointerDown={(e) => e.stopPropagation()}
						onClick={() => setOverlayDismissed(true)}
						class="absolute top-2 right-2 z-10 cursor-pointer text-white/80 hover:text-white transition-colors opacity-0 group-hover/ov:opacity-100 [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
					>
						<XIcon width={16} height={16} />
					</button>
					<div class="absolute bottom-0 left-0 w-full z-10 flex flex-row items-center justify-end gap-4 px-4 pb-4 pt-8 pointer-events-none bg-linear-to-t from-background from-0% via-background/60 via-45% to-transparent to-100% opacity-0 translate-y-2 group-hover/ov:opacity-100 group-hover/ov:translate-y-0 transition-all duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
						<Show when={voiceData.states.camEnabled}>
							<Tooltip placement="top">
								<TooltipTrigger
									as="button"
									type="button"
									aria-label="Stop Camera"
									onPointerDown={(e: PointerEvent) => e.stopPropagation()}
									onClick={toggleCamera}
									class="pointer-events-auto cursor-pointer text-white hover:text-primary transition-colors"
								>
									<VideoCameraSlashFillIcon width={20} height={20} />
								</TooltipTrigger>
								<TooltipPortal>
									<TooltipContent>Stop Camera</TooltipContent>
								</TooltipPortal>
							</Tooltip>
						</Show>
						<Show when={voiceData.states.screenEnabled}>
							<Tooltip placement="top">
								<TooltipTrigger
									as="button"
									type="button"
									aria-label="Stop Streaming"
									onPointerDown={(e: PointerEvent) => e.stopPropagation()}
									onClick={toggleScreen}
									class="pointer-events-auto cursor-pointer text-white hover:text-primary transition-colors"
								>
									<MonitorXIcon width={20} height={20} />
								</TooltipTrigger>
								<TooltipPortal>
									<TooltipContent>Stop Streaming</TooltipContent>
								</TooltipPortal>
							</Tooltip>
						</Show>
						<Tooltip placement="top">
							<TooltipTrigger
								as="button"
								type="button"
								aria-label="Disconnect"
								onPointerDown={(e: PointerEvent) => e.stopPropagation()}
								onClick={disconnect}
								class="pointer-events-auto cursor-pointer text-white hover:text-red-300 transition-colors"
							>
								<PhoneSlashFillIcon width={20} height={20} />
							</TooltipTrigger>
							<TooltipPortal>
								<TooltipContent>Disconnect</TooltipContent>
							</TooltipPortal>
						</Tooltip>
					</div>
					<div
						onPointerDown={onResizePointerDown}
						class={`absolute z-10 w-4 h-4 ${resizeCornerClass()} opacity-0 group-hover/ov:opacity-100 transition-opacity`}
					>
						<div class="w-2 h-2 m-1 rounded-sm bg-foreground/40" />
					</div>
				</div>
			</Portal>
		</Show>
	);
};
