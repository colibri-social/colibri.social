import { useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import CaretLeftIcon from "~icons/ph/caret-left";
import DotsThreeVerticalIcon from "~icons/ph/dots-three-vertical";
import PhoneCallIcon from "~icons/ph/phone-call";
import PhoneSlashIcon from "~icons/ph/phone-slash";
import SpeakerHighIcon from "~icons/ph/speaker-high-fill";
import UsersIcon from "~icons/ph/users";
import UsersIconFill from "~icons/ph/users-fill";
import { resolveBlob } from "../../atproto/resolve-blob";
import type { Member } from "../../atproto/xrpc/social/colibri/community/listMembers";
import { useCommunityContext } from "../../contexts/Community";
import { useUserContext } from "../../contexts/User";
import { useUserPreferences } from "../../contexts/UserPreferences";
import { ConnectionState, useVoiceChatContext } from "../../contexts/VoiceChat";
import { preloadNoiseSuppressor } from "../../hooks/createNoiseSuppressor";
import { noiseMode } from "../../hooks/noise/modes";
import { getAverageColorFromUrl } from "../../utils/get-average-color";
import { createLogger } from "../../utils/logger";
import { createMobilePane } from "../../utils/mobile-pane";
import { Camera } from "../icons/Camera";
import { Ear } from "../icons/Ear";
import { Microphone } from "../icons/Microphone";
import { Screen } from "../icons/Screen";
import { Button } from "../ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../ui/Tooltip";
import { MemberContextMenu } from "./community/MemberContextMenu";
import { DEFAULT_BANNER } from "./profile/theme";
import User from "./user";
import { displayableNameFn } from "./user/DisplayableName";
import { ScreenShareButton } from "./voice/ScreenShareButton";

const log = createLogger("voice/view");

export const VideoTile: Component<{
	stream: MediaStream;
	mirror?: boolean;
	debugLabel?: string;
}> = (props) => {
	let ref: HTMLVideoElement | undefined;
	const tag = () => `[voice/video ${props.debugLabel ?? props.stream.id}]`;

	const snapshot = (el: HTMLVideoElement) => ({
		readyState: el.readyState,
		networkState: el.networkState,
		paused: el.paused,
		muted: el.muted,
		videoWidth: el.videoWidth,
		videoHeight: el.videoHeight,
		tracks: (el.srcObject as MediaStream | null)?.getVideoTracks().map((t) => ({
			readyState: t.readyState,
			enabled: t.enabled,
			muted: t.muted,
		})),
	});

	const play = (reason: string): void => {
		const el = ref;

		if (!el) return;

		el.play()
			.then(() => log.debug("play() ok", { via: reason, tag: tag() }))
			.catch((err) =>
				log.warn("play() rejected", {
					via: reason,
					tag: tag(),
					error: err,
					...snapshot(el),
				}),
			);
	};

	createEffect(() => {
		const el = ref;

		if (!el) return;

		el.srcObject = props.stream;
		el.muted = true;
		el.playsInline = true;

		log.debug("srcObject set", { tag: tag(), ...snapshot(el) });

		play("effect");
	});

	return (
		<video
			ref={ref}
			autoplay
			muted
			playsinline
			onLoadedMetadata={() => play("loadedmetadata")}
			onCanPlay={() => play("canplay")}
			onPlaying={() => log.debug("playing", { tag: tag() })}
			onPause={() =>
				ref && log.debug("paused", { tag: tag(), ...snapshot(ref) })
			}
			onStalled={() => log.warn("stalled", { tag: tag() })}
			onWaiting={() => log.warn("waiting", { tag: tag() })}
			onError={() =>
				ref &&
				log.error("video element errored", { tag: tag(), error: ref.error })
			}
			class="w-full h-full object-contain rounded-md"
			classList={{ "-scale-x-100": props.mirror }}
		/>
	);
};

type TileDescriptor =
	| { kind: "participant"; key: string; member: Member }
	| { kind: "screen"; key: string; stream: MediaStream; member?: Member };

const gridColumns = (n: number): number => (n <= 1 ? 1 : n <= 6 ? 2 : 3);

const SCROLL_THRESHOLD = 10;

const GRID_GAP_PX = 12;

const tileBackground = (member: Member, avatarColor?: string): string => {
	const theme = member.data.theme;
	if (theme?.gradient?.primary && theme.gradient.secondary)
		return `linear-gradient(135deg, ${theme.gradient.primary}, ${theme.gradient.secondary})`;
	if (theme?.bannerColor && theme.bannerColor !== DEFAULT_BANNER)
		return theme.bannerColor;
	return avatarColor ?? DEFAULT_BANNER;
};

export const VoiceChannelView: Component = () => {
	const params = useParams();
	const community = useCommunityContext();
	const user = useUserContext();
	const preferences = useUserPreferences();
	const { isMobile, popPane, pushPane } = createMobilePane();
	const [
		voiceData,
		{
			connect,
			disconnect,
			toggleMic,
			toggleDeafen,
			toggleCamera,
			setFocusedKey,
		},
	] = useVoiceChatContext();

	// Warm the DeepFilterNet assets while the user is looking at a voice channel,
	// so joining swaps from the low tier to the neural model instantly
	onMount(() => {
		if (
			noiseMode(preferences.preferences().voice.input.noiseSuppressionMode)
				.usesDeepFilterNet
		) {
			preloadNoiseSuppressor();
		}
	});

	const channelName = () => {
		const rkey = params.channel;
		return (
			community().channels.find((c) => c.uri.split("/").pop() === rkey)?.name ??
			rkey
		);
	};

	const channelUri = (): string | undefined =>
		community().channels.find((c) => c.uri.split("/").pop() === params.channel)
			?.uri;

	const isActiveHere = (): boolean =>
		voiceData.connection.uri === channelUri() &&
		voiceData.connection.state !== ConnectionState.Disconnected;

	const joinHere = (): void => {
		const channel = channelUri();

		if (channel) {
			connect(channel, {
				channelName: channelName(),
				communityName: community().community.name,
				hubDid: community().community.appview,
			});
		}
	};

	const participantMembers = createMemo(() => {
		const uri = channelUri();
		const dids = uri ? (voiceData.presence[uri] ?? []) : [];

		return dids
			.map((did) => community().members.find((m) => m.did === did))
			.filter(Boolean);
	});

	const cameraFor = (did: string): MediaStream | undefined =>
		Object.values(voiceData.videoStreams).find(
			(v) => v.did === did && v.source === "cam",
		)?.stream;

	const screenShares = createMemo(() =>
		Object.entries(voiceData.videoStreams)
			.filter(([, v]) => v.source === "screen")
			.map(([key, v]) => ({
				key,
				stream: v.stream,
				member: community().members.find((m) => m.did === v.did),
			})),
	);

	const tiles = createMemo<TileDescriptor[]>(() => {
		const view = preferences.preferences().voice;
		const list: TileDescriptor[] = [];

		for (const member of participantMembers()) {
			if (!member) continue;
			const hasCam = !!cameraFor(member.did);
			if (view.showNonVideoParticipants === false && !hasCam) continue;
			if (member.did === user.did && hasCam && view.showOwnCamera === false)
				continue;
			list.push({ kind: "participant", key: `p:${member.did}`, member });
		}

		for (const share of screenShares()) {
			list.push({
				kind: "screen",
				key: `s:${share.key}`,
				stream: share.stream,
				member: share.member,
			});
		}

		return list;
	});

	const columns = () => gridColumns(tiles().length);

	const cellWidth = () =>
		`calc((100% - ${(columns() - 1) * GRID_GAP_PX}px) / ${columns()})`;

	const gridRows = createMemo<TileDescriptor[][]>(() => {
		const all = tiles();
		const cols = columns();
		const rows: TileDescriptor[][] = [];

		for (let i = 0; i < all.length; i += cols) {
			rows.push(all.slice(i, i + cols));
		}

		return rows;
	});

	const [gridSize, setGridSize] = createSignal({ w: 0, h: 0 });

	const observeGrid = (el: HTMLDivElement): void => {
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) setGridSize({ w: rect.width, h: rect.height });
		});

		observer.observe(el);

		onCleanup(() => observer.disconnect());
	};

	/** Pixel size of each balanced-grid tile, kept at 16:9 and fit to the area. */
	const tileDims = createMemo(() => {
		const { w, h } = gridSize();
		const cols = columns();
		const rows = gridRows().length;

		if (!w || !h || !cols || !rows) return null;

		const availW = w - GRID_GAP_PX * (cols - 1);
		const availH = h - GRID_GAP_PX * (rows - 1);
		const tileW = Math.min(availW / cols, (availH / rows) * (16 / 9));

		return { w: tileW, h: tileW * (9 / 16) };
	});

	const toggleFocus = (key: string): void => {
		setFocusedKey(voiceData.focusedKey === key ? null : key);
	};

	/** Open the member context menu at the clicked options button. */
	const openTileMenu = (e: MouseEvent): void => {
		e.preventDefault();
		e.stopPropagation();

		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();

		el.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				clientX: rect.left,
				clientY: rect.top,
			}),
		);
	};

	const participantsSentence = (): string => {
		const names = participantMembers().map((m) => displayableNameFn(m!));

		if (names.length === 0) return "";
		if (names.length === 1) return `${names[0]} is in this voice channel.`;
		if (names.length === 2)
			return `${names[0]} and ${names[1]} are in this voice channel.`;

		return `${names.slice(0, -1).join(", ")} and ${
			names[names.length - 1]
		} are in this voice channel.`;
	};

	const ParticipantTile: Component<{
		member: Member;
		onSelect?: () => void;
		compact?: boolean;
		plain?: boolean;
	}> = (props) => {
		const isSpeaking = () =>
			voiceData.activeSpeakers.includes(props.member.did);

		const hasVideo = () => !props.plain && !!cameraFor(props.member.did);

		const [avatarColor, setAvatarColor] = createSignal<string>();

		createEffect(() => {
			const src = resolveBlob(props.member.did, props.member.data.avatar);

			if (!src) return;

			getAverageColorFromUrl(src).then(
				(color) => color && setAvatarColor(color.hex),
			);
		});

		return (
			<div
				onClick={props.plain ? undefined : props.onSelect}
				class="group w-full h-full relative overflow-hidden rounded-md flex flex-col items-center justify-center gap-2 border transition-colors duration-75"
				classList={{
					"border-primary shadow-[0_0_0_2px] shadow-primary": isSpeaking(),
					"border-border": !isSpeaking(),
					"cursor-pointer": !props.plain,
				}}
				style={{
					background: hasVideo()
						? undefined
						: tileBackground(props.member, avatarColor()),
				}}
			>
				<Show when={!props.plain}>
					<span
						class="absolute flex flex-row items-center w-fit max-w-[calc(100%-1rem)] bg-background/75 border border-border rounded-sm z-10"
						classList={{
							"gap-2 px-2 h-8 bottom-2 left-2": !props.compact,
							"gap-1 px-1.5 h-6 text-xs bottom-1 left-1": props.compact,
							"opacity-0 group-hover/vc:opacity-100":
								!voiceData.memberStates[props.member.did]?.muted &&
								!voiceData.memberStates[props.member.did]?.deafened &&
								!voiceData.memberStates[props.member.did]?.serverMuted &&
								!voiceData.memberStates[props.member.did]?.serverDeafened,
						}}
					>
						<Show
							when={
								voiceData.memberStates[props.member.did]?.muted &&
								!voiceData.memberStates[props.member.did]?.deafened &&
								!voiceData.memberStates[props.member.did]?.serverMuted
							}
						>
							<Microphone
								className="text-destructive"
								size={props.compact ? 12 : 16}
								enabled={false}
							/>
						</Show>
						<Show when={voiceData.memberStates[props.member.did]?.serverMuted}>
							<Microphone
								className="text-amber-500"
								size={props.compact ? 12 : 16}
								enabled={false}
							/>
						</Show>
						<Show when={voiceData.memberStates[props.member.did]?.deafened}>
							<Ear
								className="text-destructive"
								size={props.compact ? 12 : 16}
								enabled={true}
							/>
						</Show>
						<Show
							when={voiceData.memberStates[props.member.did]?.serverDeafened}
						>
							<Ear
								className="text-amber-500"
								size={props.compact ? 12 : 16}
								enabled={true}
							/>
						</Show>
						<span class="hidden group-hover/vc:block truncate">
							<User.DisplayableName color={false} user={props.member} />
						</span>
					</span>
				</Show>
				<Show
					when={hasVideo()}
					fallback={
						<User.Avatar
							user={props.member}
							disableState={true}
							size={props.compact ? "base" : "large"}
						/>
					}
				>
					<VideoTile
						stream={cameraFor(props.member.did)!}
						mirror={props.member.did === user.did}
						debugLabel={`cam:${displayableNameFn(props.member)}`}
					/>
				</Show>
				<Show when={!props.compact && !props.plain}>
					<button
						type="button"
						aria-label="Options"
						onClick={openTileMenu}
						class="absolute bottom-2 right-2 w-7 h-7 rounded-md bg-background/75 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
					>
						<DotsThreeVerticalIcon width={18} height={18} />
					</button>
				</Show>
			</div>
		);
	};

	const ScreenTile: Component<{
		stream: MediaStream;
		member?: Member;
		onSelect: () => void;
	}> = (props) => (
		<div
			onClick={props.onSelect}
			class="w-full h-full relative overflow-hidden rounded-md border border-border cursor-pointer"
		>
			<VideoTile
				stream={props.stream}
				debugLabel={`screen:${props.member ? displayableNameFn(props.member) : "?"}`}
			/>
			<span class="absolute flex flex-row items-center gap-2 px-2 h-8 bottom-2 left-2 w-fit max-w-[calc(100%-1rem)] bg-background/75 border border-border rounded-sm z-10">
				<Screen enabled={true} size={16} />
				<span class="truncate">
					<Show when={props.member} fallback={<>Screen</>}>
						<User.DisplayableName color={false} user={props.member!} />
					</Show>
				</span>
			</span>
		</div>
	);

	const renderTile = (t: TileDescriptor, compact = false) =>
		t.kind === "participant" ? (
			<MemberContextMenu member={t.member} class="w-full h-full aspect-video">
				<ParticipantTile
					member={t.member}
					onSelect={() => toggleFocus(t.key)}
					compact={compact}
				/>
			</MemberContextMenu>
		) : (
			<ScreenTile
				stream={t.stream}
				member={t.member}
				onSelect={() => toggleFocus(t.key)}
			/>
		);

	return (
		<div class="w-full h-full flex flex-col group/vc relative overflow-hidden">
			<div
				class="flex items-center gap-2 justify-between px-4 z-10"
				classList={{
					"absolute top-0 left-0 w-full h-16 pt-2 bg-linear-to-b from-background from-0% via-background/70 via-45% to-transparent to-100% opacity-0 -translate-y-2 group-hover/vc:opacity-100 group-hover/vc:translate-y-0 transition-all duration-200":
						isActiveHere(),
					"w-full h-12 min-h-12 border-b border-border": !isActiveHere(),
				}}
			>
				<div class="flex items-center gap-2 px-4 z-10 pointer-events-none">
					<Show when={isMobile()}>
						<button
							type="button"
							onClick={() => popPane()}
							class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/50 cursor-pointer -ml-2 pointer-events-auto"
							aria-label="Back"
						>
							<CaretLeftIcon width={20} height={20} />
						</button>
					</Show>
					<SpeakerHighIcon />
					<span class="font-medium">{channelName()}</span>
					<Show
						when={voiceData.connection.state === ConnectionState.Connecting}
					>
						<span class="text-xs text-muted-foreground ml-auto">
							Connecting...
						</span>
					</Show>
				</div>
				<Tooltip>
					<TooltipTrigger>
						<Button
							size="sm"
							variant="ghost"
							class="w-8 h-8"
							onClick={() =>
								isMobile()
									? pushPane("members")
									: preferences.toggleMembersVisible()
							}
						>
							<Switch>
								<Match when={preferences.preferences().membersListVisible}>
									<UsersIconFill />
								</Match>
								<Match when={!preferences.preferences().membersListVisible}>
									<UsersIcon />
								</Match>
							</Switch>
						</Button>
					</TooltipTrigger>
					<TooltipPortal>
						<TooltipContent>
							<Switch>
								<Match when={preferences.preferences().membersListVisible}>
									Hide Member List
								</Match>
								<Match when={!preferences.preferences().membersListVisible}>
									Show Member List
								</Match>
							</Switch>
						</TooltipContent>
					</TooltipPortal>
				</Tooltip>
			</div>

			<Show
				when={isActiveHere()}
				fallback={
					<div class="flex-1 min-h-0 overflow-y-auto overflow-x-clip p-6 flex flex-col items-center justify-center gap-6 text-center">
						<Show when={participantMembers().length > 0}>
							<div class="flex flex-row flex-wrap items-center justify-center gap-3 max-w-2xl">
								<For each={participantMembers()}>
									{(member) => (
										<div class="w-40 aspect-video">
											<ParticipantTile member={member!} plain compact />
										</div>
									)}
								</For>
							</div>
						</Show>
						<div class="flex flex-col items-center gap-2">
							<h2 class="text-2xl my-0 font-bold">{channelName()}</h2>
						</div>
						<Show
							when={participantMembers().length > 0}
							fallback={
								<p class="text-muted-foreground text-sm">
									No one's in this channel yet.
								</p>
							}
						>
							<p class="text-sm text-muted-foreground max-w-md">
								{participantsSentence()}
							</p>
						</Show>
						<Button class="gap-2" onClick={joinHere}>
							<PhoneCallIcon />
							Join Voice
						</Button>
					</div>
				}
			>
				<div class="flex-1 min-h-0 flex flex-col gap-4">
					<Show
						when={tiles().length > 0}
						fallback={
							<div class="w-full h-full flex items-center justify-center text-muted-foreground">
								Nobody's here yet.
							</div>
						}
					>
						<Show
							when={voiceData.focusedKey}
							fallback={
								<Show
									when={tiles().length >= SCROLL_THRESHOLD}
									fallback={
										<div
											ref={observeGrid}
											class="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4"
										>
											<For each={gridRows()}>
												{(row) => (
													<div class="flex flex-row justify-center gap-3">
														<For each={row}>
															{(t) => (
																<div
																	class="min-w-0"
																	classList={{ "aspect-video": !tileDims() }}
																	style={
																		tileDims()
																			? {
																					width: `${tileDims()!.w}px`,
																					height: `${tileDims()!.h}px`,
																				}
																			: { width: cellWidth() }
																	}
																>
																	{renderTile(t)}
																</div>
															)}
														</For>
													</div>
												)}
											</For>
										</div>
									}
								>
									<div class="flex-1 min-h-0 overflow-y-auto overflow-x-clip p-4">
										<div class="grid grid-cols-3 gap-3">
											<For each={tiles()}>
												{(t) => <div class="aspect-video">{renderTile(t)}</div>}
											</For>
										</div>
									</div>
								</Show>
							}
						>
							<div class="flex-1 min-h-0 flex items-center justify-center px-4 pt-4">
								<For each={tiles()}>
									{(t) => (
										<Show when={t.key === voiceData.focusedKey}>
											<div class="w-auto h-full">{renderTile(t)}</div>
										</Show>
									)}
								</For>
							</div>
							<div class="shrink-0 h-40 flex flex-row items-center justify-center gap-2 overflow-x-auto px-4 pt-1 pb-20">
								<For each={tiles()}>
									{(t) => (
										<div
											class="h-full aspect-video shrink-0 transition-opacity"
											classList={{
												"opacity-40 hover:opacity-100":
													t.key === voiceData.focusedKey,
											}}
										>
											{renderTile(t, true)}
										</div>
									)}
								</For>
							</div>
						</Show>
					</Show>
				</div>
				<div class="absolute bottom-0 left-0 w-full z-10 flex items-center justify-center px-4 pb-4 pt-12 pointer-events-none bg-linear-to-t from-background from-0% via-background/70 via-55% to-transparent to-100% opacity-0 translate-y-2 group-hover/vc:opacity-100 group-hover/vc:translate-y-0 transition-all duration-200">
					<div class="flex items-center justify-center gap-2 pointer-events-auto">
						<Button
							variant={voiceData.states.micEnabled ? "secondary" : "outline"}
							class="gap-2"
							classList={{
								"text-(--primary-hover)!": voiceData.states.micEnabled,
								"text-red-400": !voiceData.states.micEnabled,
							}}
							onClick={toggleMic}
						>
							<Microphone enabled={voiceData.states.micEnabled} />
						</Button>
						<Button
							variant={voiceData.states.deafened ? "secondary" : "outline"}
							class="gap-2"
							classList={{
								"text-foreground": !voiceData.states.deafened,
								"text-red-400!": voiceData.states.deafened,
							}}
							onClick={toggleDeafen}
						>
							<Ear enabled={voiceData.states.deafened} />
						</Button>
						<Button
							variant={voiceData.states.camEnabled ? "secondary" : "outline"}
							class="gap-2"
							classList={{
								"text-(--primary-hover)!": voiceData.states.camEnabled,
								"text-foreground": !voiceData.states.camEnabled,
							}}
							onClick={toggleCamera}
						>
							<Camera enabled={voiceData.states.camEnabled} />
						</Button>
						<ScreenShareButton />
						<Button variant="destructive" class="gap-2" onClick={disconnect}>
							<PhoneSlashIcon />
							Leave
						</Button>
					</div>
				</div>
			</Show>
		</div>
	);
};
