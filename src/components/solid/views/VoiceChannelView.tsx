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
import { Microphone } from "../icons/Microphone";
import { Ear } from "../icons/Ear";
import { Camera } from "../icons/Camera";
import { Screen } from "../icons/Screen";
import { PhoneSlash } from "../icons/PhoneSlash";

/**
 * A single participant video tile
 */
const ParticipantVideo: Component<{
	tile: ParticipantTile;
}> = (props) => {
	let videoRef: HTMLVideoElement | undefined;
	let audioRef: HTMLAudioElement | undefined;

	const { members } = useCommunityContext()!;
	const [context, utils] = useVoiceChatContext();

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

	const member = (did: string) => members().find((x) => x.member_did === did)!;

	return (
		<div
			class="relative bg-background border border-border rounded-md outline-2 -outline-offset-2 w-full aspect-video overflow-hidden transition-all duration-75"
			onClick={() => utils.toggleFocusedTile(props.tile)}
			classList={{
				"outline-primary": isSpeaking(),
				"outline-transparent": !isSpeaking(),
			}}
		>
			<Show
				when={props.tile.videoTrack?.enabled}
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
	const channelData = useChannelContext()!;
	const params = useParams();

	const channel = () => params.channel!;

	const activeChannel = () =>
		channelData.channels().find((c) => c.rkey === channel())!;

	const isConnected = () =>
		voiceChatContext.connectionState === ConnectionState.Connected;

	const focusedTile = () => voiceChatContext.focusedTile;

	const tiles = () => voiceChatContext.tiles.filter(t => 
		focusedTile()?.participant.sid !== t.participant.sid || focusedTile()?.isStream !== t.isStream
);
	const cols = () => Math.min(tiles().length, 3);
	const rows = () => {
		const t = tiles();
		const c = cols();
		const result: (typeof t)[] = [];
		for (let i = 0; i < t.length; i += c) result.push(t.slice(i, i + c));
		return result;
	};

	return (
		<div class="flex flex-col gap-0 bg-background h-full text-muted-foreground">
			<Show when={voiceChatContext.error}>
				<div class="bg-destructive/10 p-4 border-destructive border-b text-foreground text-sm">
					{voiceChatContext.error}
				</div>
			</Show>

			<div class="flex-1 overflow-y-auto flex flex-col gap-4 p-4 w-full min-h-full">
				<div class="h-fit">
					<Show when={focusedTile() !== null}>
						<ParticipantVideo tile={focusedTile()!} />
					</Show>
				</div>
				<div class={`flex flex-col justify-center gap-4 ${focusedTile() ? "" : "h-full"}`}>
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
						<div class="m-auto text-muted-foreground text-sm text-center">
							Nobody's here yet.
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
								variant={voiceChatContext.micEnabled ? "secondary" : "outline"}
								classList={{
									"text-(--primary-hover)!": voiceChatContext.micEnabled,
									"text-red-400": !voiceChatContext.micEnabled,
								}}
								onClick={toggleMic}
							>
								<Microphone enabled={voiceChatContext.micEnabled} />
							</Button>
							<Button
								variant={voiceChatContext.isDeafened ? "secondary" : "outline"}
								classList={{
									"text-foreground": !voiceChatContext.isDeafened,
									"text-red-400!": voiceChatContext.isDeafened,
								}}
								onClick={toggleDeafen}
							>
								<Ear enabled={voiceChatContext.isDeafened} />
							</Button>
							<Button
								variant={voiceChatContext.camEnabled ? "secondary" : "outline"}
								classList={{
									"text-(--primary-hover)!": voiceChatContext.camEnabled,
									"text-foreground": !voiceChatContext.camEnabled,
								}}
								onClick={toggleCamera}
							>
								<Camera enabled={voiceChatContext.camEnabled} />
							</Button>
							<Button
								variant={
									voiceChatContext.screenEnabled ? "secondary" : "outline"
								}
								classList={{
									"text-(--primary-hover)!": voiceChatContext.screenEnabled,
									"text-foreground": !voiceChatContext.screenEnabled,
								}}
								onClick={toggleScreen}
							>
								<Screen enabled={voiceChatContext.screenEnabled} />
							</Button>
							<div class="ml-auto">
								<Button variant={"destructive"} onClick={disconnect}>
									<PhoneSlash />
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
