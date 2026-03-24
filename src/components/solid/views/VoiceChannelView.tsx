import { useParams } from "@solidjs/router";
import { ConnectionState } from "livekit-client";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import { Icon } from "@/components/solid/icons/Icon";
import { createIsSpeaking } from "@/lib/hooks/createIsSpeaking";
import { useChannelContext } from "../contexts/ChannelContext";
import { useCommunityContext } from "../contexts/CommunityContext";
import { useGlobalContext } from "../contexts/GlobalContext";
import {
	type ParticipantTile,
	useVoiceChatContext,
} from "../contexts/VoiceChatContext";
import { Camera } from "../icons/Camera";
import { Ear } from "../icons/Ear";
import { Microphone } from "../icons/Microphone";
import { Screen } from "../icons/Screen";
import type { MemberData } from "../layouts/CommunityLayout";
import { Button } from "../shadcn-solid/Button";
import { usePreferencesContext } from "../contexts/UserPreferencesContext";

/**
 * A tile shown when viewing the voice channel without being connected.
 */
const MockTile: Component<{
	avatar_url: string;
	display_name: string;
	did: string;
	handle?: string;
}> = (props) => {
	return (
		<div class="relative bg-background border border-border rounded-md w-full aspect-video overflow-hidden">
			<div class="flex justify-center items-center h-full text-muted-foreground text-sm">
				<img
					src={props.avatar_url || "/user-placeholder.png"}
					width={64}
					height={64}
					alt={props.display_name || props.handle}
					class="inline bottom-0.5 relative mr-2 rounded-full"
				/>
			</div>

			<div class="bottom-2 left-2 absolute bg-black/90 backdrop-blur-sm px-2 py-0.5 rounded-sm text-muted-foreground text-sm">
				{props.display_name || props.handle}
			</div>
		</div>
	);
};

/**
 * A single participant video tile
 */
const ParticipantVideo: Component<{
	tile: ParticipantTile;
}> = (props) => {
	let videoRef: HTMLVideoElement | undefined;
	const [videoRefReady, setVideoRefReady] = createSignal(false);

	const communityData = useCommunityContext()!;
	const [context, utils] = useVoiceChatContext();

	const { isSpeaking } = createIsSpeaking(() => props.tile.audioTrack, {
		threshold: 0.01,
		intervalMs: 80,
	});

	const [videoEnabled, setVideoEnabled] = createSignal(
		props.tile.videoTrack?.enabled ?? false,
	);

	const trackId = () => props.tile.videoTrack?.id ?? null;

	createEffect(() => {
		const _ = trackId();
		const vTrack = props.tile.videoTrack;

		setVideoEnabled(vTrack?.enabled ?? false);

		if (!vTrack) return;

		const onUnmute = () => setVideoEnabled(true);
		const onMute = () => setVideoEnabled(false);

		vTrack.addEventListener("unmute", onUnmute);
		vTrack.addEventListener("mute", onMute);

		onCleanup(() => {
			vTrack.removeEventListener("unmute", onUnmute);
			vTrack.removeEventListener("mute", onMute);
		});
	});

	createEffect(() => {
		videoRefReady();
		const vTrack = props.tile.videoTrack;

		if (!videoRef) return;

		if (vTrack) {
			const existing = videoRef.srcObject as MediaStream | null;
			if (existing?.getTracks()[0]?.id === vTrack.id) return;

			videoRef.pause();
			videoRef.srcObject = new MediaStream([vTrack]);

			videoRef.play().catch((e) => {
				if (e.name === "AbortError") return;
				console.error("Error playing video:", e);
			});
		} else {
			videoRef.pause();
			videoRef.srcObject = null;
		}
	});

	const member = (did: string) =>
		communityData.members().find((x) => x.member_did === did) ??
		({} as MemberData);

	return (
		<div
			class="relative bg-background border border-border rounded-md outline-2 -outline-offset-2 w-full aspect-video overflow-hidden transition-all duration-75"
			onClick={() => {
				if (context.connection.tiles.length < 2) return;
				utils.toggleFocusedTile(props.tile);
			}}
			classList={{
				"outline-primary": isSpeaking(),
				"outline-transparent": !isSpeaking(),
				"cursor-pointer": context.connection.tiles.length >= 2,
			}}
		>
			<Show
				when={videoEnabled()}
				fallback={
					<div class="flex justify-center items-center h-full text-muted-foreground text-sm">
						<img
							src={
								member(props.tile.participant.identity).avatar_url ||
								"/user-placeholder.png"
							}
							width={64}
							height={64}
							alt={
								member(props.tile.participant.identity).display_name ||
								member(props.tile.participant.identity).handle
							}
							class="inline bottom-0.5 relative mr-2 rounded-full"
						/>
					</div>
				}
			>
				<video
					ref={(el) => {
						videoRef = el;
						setVideoRefReady(true);
					}}
					autoplay
					muted={props.tile.isLocal}
					playsinline
					class="w-full h-full object-cover transform"
					classList={{
						"-scale-x-100": !props.tile.isStream,
					}}
				/>
			</Show>

			<div class="bottom-2 left-2 absolute bg-black/90 backdrop-blur-sm px-2 py-0.5 rounded-sm text-muted-foreground text-sm">
				{props.tile.isLocal
					? `${member(props.tile.participant.identity).display_name || member(props.tile.participant.identity).handle} (you)`
					: member(props.tile.participant.identity).display_name ||
						member(props.tile.participant.identity).handle}
			</div>
		</div>
	);
};

/**
 * A voice/video room.
 */
const LiveKitRoom: Component = () => {
	const [userPreferences] = usePreferencesContext();
	const [
		voiceChatContext,
		{
			toggleCamera,
			toggleMic,
			toggleScreen,
			toggleDeafen,
			connect,
			disconnect,
		},
	] = useVoiceChatContext();
	const [globalData] = useGlobalContext();
	const communityData = useCommunityContext()!;
	const channelData = useChannelContext()!;
	const params = useParams();

	const member = (did: string) =>
		communityData.members().find((x) => x.member_did === did) ??
		({} as MemberData);

	const channel = () => params.channel!;
	const activeChannel = () =>
		channelData.channels().find((c) => c.rkey === channel())!;

	const knownMembers = () => {
		const category = communityData
			.sidebar()
			?.categories.find((x) => x.rkey === activeChannel().category);

		if (!category) return [];

		const sidebarChannel = category.channels.find((x) => x.rkey === channel());

		if (!sidebarChannel) return [];

		return sidebarChannel.voice_members;
	};

	const isConnected = () =>
		voiceChatContext.connection.state === ConnectionState.Connected;

	const focusedTile = () => voiceChatContext.connection.focusedTile;

	const tiles = () =>
		voiceChatContext.connection.tiles.filter(
			(t) =>
				focusedTile()?.participant.sid !== t.participant.sid ||
				focusedTile()?.isStream !== t.isStream,
		);
	const cols = () => Math.min(tiles().length, 3);
	const rows = () => {
		const t = tiles();
		const c = cols();
		const result: (typeof t)[] = [];
		for (let i = 0; i < t.length; i += c) result.push(t.slice(i, i + c));
		return result;
	};

	const liveVoiceChannelMembers = createMemo<Array<string>>(() => {
		const updatedMemberState = globalData.knownVoiceChannelStates.find(
			(x) =>
				x.channel_rkey === channel() &&
				x.community_uri.split("/").pop()! === communityData.rkey(),
		);

		if (updatedMemberState)
			return updatedMemberState.member_dids.sort((a, b) => a.localeCompare(b));

		return knownMembers().sort((a, b) => a.localeCompare(b));
	});

	return (
		<div class="flex flex-col gap-0 bg-background h-full text-muted-foreground">
			<Show when={voiceChatContext.connection.error}>
				<div class="bg-destructive/10 p-4 border-destructive border-b text-foreground text-sm">
					{voiceChatContext.connection.error}
				</div>
			</Show>

			<div class="flex-1 overflow-y-auto flex flex-col gap-4 p-4 w-full h-full max-h-[calc(100%-4rem)]">
				<div class="h-fit">
					<Show when={focusedTile() !== null}>
						<ParticipantVideo tile={focusedTile()!} />
					</Show>
				</div>
				<div
					class={`flex flex-col justify-center gap-4 ${focusedTile() ? "" : "h-full"}`}
				>
					<For each={rows()}>
						{(row) => (
							<div class="flex justify-center gap-4">
								<For each={row}>
									{(tile) => (
										<div
											style={{
												flex: `0 1 calc(${100 / cols()}% - ${((cols() - 1) * 16) / cols()}px)`,
												"min-width": 0,
											}}
										>
											<ParticipantVideo
												tile={{
													...tile,
												}}
											/>
										</div>
									)}
								</For>
							</div>
						)}
					</For>

					<Show when={liveVoiceChannelMembers().length === 0 && !isConnected()}>
						<div class="m-auto text-muted-foreground text-sm text-center">
							Nobody's here yet.
						</div>
					</Show>

					<Show when={liveVoiceChannelMembers().length > 0 && !isConnected()}>
						<div class="flex justify-center gap-4">
							<For each={liveVoiceChannelMembers()}>
								{(did) => (
									<div
										style={{
											flex: `0 1 calc(${100 / Math.min(liveVoiceChannelMembers().length, 3)}% - ${((Math.min(liveVoiceChannelMembers().length, 3) - 1) * 16) / Math.min(liveVoiceChannelMembers().length, 3)}px)`,
											"min-width": 0,
										}}
									>
										<MockTile
											avatar_url={member(did).avatar_url}
											display_name={member(did).display_name}
											handle={member(did).handle}
											did={member(did).member_did}
										/>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>
			</div>

			<div class="flex flex-row flex-wrap items-center gap-2 px-4 border-border border-t h-16">
				<Show
					when={!isConnected()}
					fallback={
						<>
							<Button
								variant={
									userPreferences.voice.input.enabled ? "secondary" : "outline"
								}
								classList={{
									"text-(--primary-hover)!":
										userPreferences.voice.input.enabled,
									"text-red-400": !userPreferences.voice.input.enabled,
								}}
								onClick={toggleMic}
							>
								<Microphone enabled={userPreferences.voice.input.enabled} />
							</Button>
							<Button
								variant={
									!userPreferences.voice.output.enabled
										? "secondary"
										: "outline"
								}
								classList={{
									"text-foreground": userPreferences.voice.output.enabled,
									"text-red-400!": !userPreferences.voice.output.enabled,
								}}
								onClick={toggleDeafen}
							>
								<Ear enabled={!userPreferences.voice.output.enabled} />
							</Button>
							<Button
								variant={
									voiceChatContext.states.camEnabled ? "secondary" : "outline"
								}
								classList={{
									"text-(--primary-hover)!": voiceChatContext.states.camEnabled,
									"text-foreground": !voiceChatContext.states.camEnabled,
								}}
								onClick={toggleCamera}
							>
								<Camera enabled={voiceChatContext.states.camEnabled} />
							</Button>
							<Button
								variant={
									voiceChatContext.states.screenEnabled
										? "secondary"
										: "outline"
								}
								classList={{
									"text-(--primary-hover)!":
										voiceChatContext.states.screenEnabled,
									"text-foreground": !voiceChatContext.states.screenEnabled,
								}}
								onClick={toggleScreen}
							>
								<Screen enabled={voiceChatContext.states.screenEnabled} />
							</Button>
							<div class="ml-auto">
								<Button variant={"destructive"} onClick={disconnect}>
									<Icon variant="regular" name="phone-slash-icon" />
									Leave
								</Button>
							</div>
						</>
					}
				>
					<Button
						onClick={() =>
							connect(
								communityData.owner(),
								communityData.rkey(),
								activeChannel().rkey,
								activeChannel().name,
							)
						}
					>
						Join Channel
					</Button>
				</Show>
			</div>
		</div>
	);
};

const VoiceChannelView: Component = () => {
	return <LiveKitRoom />;
};

export default VoiceChannelView;
