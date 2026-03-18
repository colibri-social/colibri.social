import { ConnectionState } from "livekit-client";
import { type Component, createEffect, For, Show } from "solid-js";
import {
	useVoiceChatContext,
	type ParticipantTile,
} from "../contexts/VoiceChatContext";
import { useCommunityContext } from "../contexts/CommunityContext";
import { createIsSpeaking } from "@/lib/hooks/createIsSpeaking";
import { Button } from "../shadcn-solid/Button";
import { useChannelContext } from "../contexts/ChannelContext";
import { useParams } from "@solidjs/router";

/**
 * A single participant video tile
 */
const ParticipantVideo: Component<{
	tile: ParticipantTile;
}> = (props) => {
	let videoRef: HTMLVideoElement | undefined;
	let audioRef: HTMLAudioElement | undefined;

	const { members } = useCommunityContext()!;

	const isSpeaking = createIsSpeaking(props.tile.audioTrack, {
		threshold: 0.05,
		intervalMs: 80,
	});

	createEffect(() => {
		const vTrack = props.tile.videoTrack;
		if (videoRef && vTrack) {
			videoRef.srcObject = new MediaStream([vTrack]);
			videoRef.play().catch(() => {
				// Autoplay may be blocked.
				// TODO: Click-to-unmute-UI
			});
		} else if (videoRef) {
			videoRef.srcObject = null;
		}
	});

	createEffect(() => {
		const aTrack = props.tile.audioTrack;
		if (audioRef && aTrack && !props.tile.isLocal) {
			audioRef.srcObject = new MediaStream([aTrack]);
			audioRef.play().catch(() => {});
		}
	});

	const member = (did: string) => members().find((x) => x.member_did === did)!;

	return (
		<div
			class="relative bg-background aspect-video rounded-md overflow-hidden transition-all duration-75 border border-border outline-2 -outline-offset-2 w-full"
			classList={{
				"outline-primary": isSpeaking(),
				"outline-transparent": !isSpeaking(),
			}}
		>
			<Show
				when={props.tile.videoTrack?.enabled}
				fallback={
					<div class="flex items-center justify-center h-full text-muted-foreground text-sm">
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
							class="rounded-full inline mr-2 relative bottom-0.5"
						/>
					</div>
				}
			>
				<video
					ref={videoRef}
					autoplay
					muted={props.tile.isLocal}
					playsinline
					class="w-full h-full object-cover transform"
					classList={{
						"-scale-x-100": !props.tile.isStream,
					}}
				/>
			</Show>

			<Show when={!props.tile.isLocal}>
				<audio ref={audioRef} autoplay class="hidden" />
			</Show>

			<div class="absolute bottom-2 left-2 bg-black/90 text-muted-foreground text-sm px-2 py-0.5 rounded-sm backdrop-blur-sm">
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
	const [
		voiceChatContext,
		{ toggleCamera, toggleMic, toggleScreen, connect, disconnect },
	] = useVoiceChatContext();
	const channelData = useChannelContext()!;
	const params = useParams();

	const channel = () => params.channel!;

	const activeChannel = () =>
		channelData.channels().find((c) => c.rkey === channel())!;

	const isConnected = () =>
		voiceChatContext.connectionState === ConnectionState.Connected;

	const tiles = () => voiceChatContext.tiles;
	const cols = () => Math.min(tiles().length, 3);
	const rows = () => {
		const t = tiles();
		const c = cols();
		const result: (typeof t)[] = [];
		for (let i = 0; i < t.length; i += c) result.push(t.slice(i, i + c));
		return result;
	};

	return (
		<div class="h-full bg-background text-muted-foreground flex flex-col gap-0">
			<Show when={voiceChatContext.error}>
				<div class="p-4 bg-destructive/10 border-b border-destructive text-sm text-foreground">
					{voiceChatContext.error}
				</div>
			</Show>

			<div class="flex-1 overflow-y-auto">
				<div class="p-4 w-full min-h-full flex flex-col gap-4 justify-center">
					<For each={rows()}>
						{(row) => (
							<div class="flex gap-4 justify-center">
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
													isSpeaking: voiceChatContext.activeSpeakers.some(
														(x) => x.identity === tile.participant.identity,
													),
												}}
											/>
										</div>
									)}
								</For>
							</div>
						)}
					</For>

					<Show when={voiceChatContext.tiles.length === 0 && !isConnected()}>
						<div class="text-muted-foreground text-sm m-auto text-center">
							Nobody's here yet.
						</div>
					</Show>
				</div>
			</div>

			<div class="px-4 flex flex-row flex-wrap items-center gap-2 h-16 border-t border-border">
				<Show
					when={!isConnected()}
					fallback={
						<>
							<Button
								variant={voiceChatContext.micEnabled ? "default" : "ghost"}
								onClick={toggleMic}
							>
								{voiceChatContext.micEnabled ? "Mic ON" : "Mic OFF"}
							</Button>
							<Button
								variant={voiceChatContext.camEnabled ? "default" : "ghost"}
								onClick={toggleCamera}
							>
								{voiceChatContext.camEnabled ? "Cam ON" : "Cam OFF"}
							</Button>
							<Button
								variant={voiceChatContext.screenEnabled ? "default" : "ghost"}
								onClick={toggleScreen}
							>
								{voiceChatContext.screenEnabled ? "Stop Share" : "Share Screen"}
							</Button>
							<div class="ml-auto">
								<Button variant={"destructive"} onClick={disconnect}>
									Leave
								</Button>
							</div>
						</>
					}
				>
					<Button
						onClick={() => connect(activeChannel().rkey, activeChannel().name)}
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
