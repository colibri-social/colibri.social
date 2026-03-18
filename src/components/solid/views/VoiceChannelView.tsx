import { useParams } from "@solidjs/router";
import { ConnectionState } from "livekit-client";
import { type Component, createEffect, For, Show } from "solid-js";
import { createIsSpeaking } from "@/lib/hooks/createIsSpeaking";
import { useChannelContext } from "../contexts/ChannelContext";
import { useCommunityContext } from "../contexts/CommunityContext";
import {
	type ParticipantTile,
	useVoiceChatContext,
} from "../contexts/VoiceChatContext";
import { Camera } from "../icons/Camera";
import { Ear } from "../icons/Ear";
import { Microphone } from "../icons/Microphone";
import { PhoneSlash } from "../icons/PhoneSlash";
import { Screen } from "../icons/Screen";
import { Button } from "../shadcn-solid/Button";

/**
 * A single participant video tile
 */
const ParticipantVideo: Component<{
	tile: ParticipantTile;
}> = (props) => {
	let videoRef: HTMLVideoElement | undefined;

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
