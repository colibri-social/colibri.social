import { useParams } from "@solidjs/router";
import { ConnectionState } from "livekit-client";
import {
	type Component,
	createMemo,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import CaretLeftIcon from "~icons/ph/caret-left";
import PhoneSlashIcon from "~icons/ph/phone-slash";
import SpeakerHighIcon from "~icons/ph/speaker-high-fill";
import { useCommunityContext } from "../../contexts/Community";
import { useVoiceChatContext } from "../../contexts/VoiceChat";
import { createMobilePane } from "../../utils/mobile-pane";
import { Camera } from "../icons/Camera";
import { Ear } from "../icons/Ear";
import { Microphone } from "../icons/Microphone";
import { Screen } from "../icons/Screen";
import { Button } from "../ui/Button";
import User from "./user";

export const VoiceChannelView: Component = () => {
	const params = useParams();
	const community = useCommunityContext();
	const { isMobile, popPane } = createMobilePane();
	const [
		voiceData,
		{
			connect,
			disconnect,
			toggleMic,
			toggleDeafen,
			toggleCamera,
			toggleScreen,
		},
	] = useVoiceChatContext();

	const channelName = () => {
		const rkey = params.channel;
		return (
			community().channels.find((c) => c.uri.split("/").pop() === rkey)?.name ??
			rkey
		);
	};

	// Auto-connect when the view mounts; disconnect when navigating away.
	onMount(() => {
		connect(params.channel);
	});
	onCleanup(() => {
		disconnect();
	});

	const participantMembers = createMemo(() =>
		voiceData.participants
			.map((did) => community().members.find((m) => m.did === did))
			.filter(Boolean),
	);

	return (
		<div class="w-full h-full flex flex-col">
			{/* Header */}
			<div class="w-full h-12 min-h-12 border-b border-border flex items-center gap-2 px-4">
				<Show when={isMobile()}>
					<button
						type="button"
						onClick={() => popPane()}
						class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted/50 cursor-pointer -ml-2"
						aria-label="Back"
					>
						<CaretLeftIcon width={20} height={20} />
					</button>
				</Show>
				<SpeakerHighIcon />
				<span class="font-medium">{channelName()}</span>
				<Show when={voiceData.connection.state === ConnectionState.Connecting}>
					<span class="text-xs text-muted-foreground ml-auto">
						Connecting...
					</span>
				</Show>
			</div>

			{/* Participant tiles */}
			<div class="flex-1 min-h-0 overflow-y-auto p-4">
				<Show
					when={participantMembers().length > 0}
					fallback={
						<div class="w-full h-full flex items-center justify-center text-muted-foreground">
							Nobody's here yet.
						</div>
					}
				>
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
						<For each={participantMembers()}>
							{(member) => {
								const isSpeaking = () =>
									voiceData.activeSpeakers.includes(member!.did);
								return (
									<div
										class="aspect-video bg-muted rounded-md flex flex-col items-center justify-center gap-2 p-4 border transition-colors duration-75"
										classList={{
											"border-primary shadow-[0_0_0_2px] shadow-primary":
												isSpeaking(),
											"border-border": !isSpeaking(),
										}}
									>
										<User.Avatar user={member!} size="large" />
										<span class="text-sm font-medium text-center truncate w-full">
											<User.DisplayableName user={member!} />
										</span>
									</div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>

			{/* Control bar */}
			<div class="w-full h-16 min-h-16 border-t border-border flex items-center justify-center gap-2 px-4 bg-card">
				<Button
					variant={voiceData.states.micEnabled ? "secondary" : "outline"}
					class="gap-2"
					onClick={toggleMic}
				>
					<Microphone enabled={voiceData.states.micEnabled} />
				</Button>
				<Button
					variant={voiceData.states.deafened ? "secondary" : "outline"}
					class="gap-2"
					onClick={toggleDeafen}
				>
					<Ear enabled={!voiceData.states.deafened} />
				</Button>
				<Button
					variant={voiceData.states.camEnabled ? "secondary" : "outline"}
					class="gap-2"
					onClick={toggleCamera}
				>
					<Camera enabled={voiceData.states.camEnabled} />
				</Button>
				<Button
					variant={voiceData.states.screenEnabled ? "secondary" : "outline"}
					class="gap-2"
					onClick={toggleScreen}
				>
					<Screen enabled={voiceData.states.screenEnabled} />
				</Button>
				<Button variant="destructive" class="gap-2" onClick={disconnect}>
					<PhoneSlashIcon />
					Leave
				</Button>
			</div>
		</div>
	);
};
