import type { OnlineState } from "@colibri-social/lib";
import { ConnectionQuality, ConnectionState } from "livekit-client";
import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	Match,
	on,
	onCleanup,
	type ParentComponent,
	type Setter,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import PhoneSlashIcon from "~icons/ph/phone-slash";
import { useUserContext } from "../../../contexts/User";
import { useVoiceChatContext } from "../../../contexts/VoiceChat";
import { Camera } from "../../icons/Camera";
import { Screen } from "../../icons/Screen";
import { Wifi } from "../../icons/Wifi";
import { Button } from "../../ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { Avatar } from "./Avatar";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { Microphone } from "../../icons/Microphone";
import { Ear } from "../../icons/Ear";
import User from ".";

const STATE_LABELS: Record<OnlineState, string> = {
	away: "Away",
	dnd: "Do Not Disturb",
	offline: "Offline",
	online: "Online",
};

const DropdownStatusSelect: ParentComponent<{
	value: OnlineState;
	setValue: Setter<OnlineState>;
}> = (props) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger>{props.children}</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent>
					<DropdownMenuGroup>
						<DropdownMenuGroupLabel class="text-xs text-muted-foreground">
							Status
						</DropdownMenuGroupLabel>
						<DropdownMenuRadioGroup value={props.value}>
							<DropdownMenuRadioItem
								value="online"
								onSelect={() => props.setValue("online")}
								class="[&_svg]:text-green-400"
							>
								{STATE_LABELS.online}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="away"
								onSelect={() => props.setValue("away")}
								class="[&_svg]:text-yellow-400"
							>
								{STATE_LABELS.away}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="dnd"
								onSelect={() => props.setValue("dnd")}
								class="[&_svg]:text-red-400"
							>
								{STATE_LABELS.dnd}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="offline"
								onSelect={() => props.setValue("offline")}
								class="[&_svg]:text-neutral-400"
							>
								{STATE_LABELS.offline}
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenu>
	);
};

/**
 * The user status visible in the community sidebar.
 */
export const Status: Component = () => {
	const user = useUserContext();
	const [
		voiceData,
		{ disconnect, toggleCamera, toggleScreen, toggleMic, toggleDeafen },
	] = useVoiceChatContext();
	const userPreferences = useUserPreferences();

	const isReconnecting = () =>
		voiceData.connection.state === ConnectionState.Connecting ||
		voiceData.connection.state === ConnectionState.Reconnecting ||
		voiceData.connection.state === ConnectionState.SignalReconnecting;

	const onlineState = () => user.data.onlineState;

	return (
		<div class="w-full h-fit flex flex-col">
			<Show when={voiceData.connection.state === ConnectionState.Connected}>
				<div class="w-full p-3 border-t border-border flex flex-col gap-2">
					<div class="flex flex-row items-center gap-2 justify-between">
						<div class="flex flex-row items-center gap-2">
							<div
								class="w-8 h-8 bg-muted/50 flex items-center justify-center rounded-sm"
								classList={{
									"bg-green-400/15":
										voiceData.connection.quality ===
										ConnectionQuality.Excellent,
									"bg-lime-400/15":
										voiceData.connection.quality === ConnectionQuality.Good,
									"bg-red-400/15":
										voiceData.connection.quality === ConnectionQuality.Poor,
									"bg-muted/50":
										voiceData.connection.quality === ConnectionQuality.Unknown,
								}}
							>
								<Wifi size={24} quality={voiceData.connection.quality} />
							</div>
							<div class="flex flex-col w-fit">
								<span
									class="text-sm font-medium"
									classList={{
										"text-green-400":
											voiceData.connection.quality ===
											ConnectionQuality.Excellent,
										"text-lime-400":
											voiceData.connection.quality === ConnectionQuality.Good,
										"text-yellow-400!": isReconnecting(),
										"text-red-400!":
											voiceData.connection.quality === ConnectionQuality.Poor ||
											voiceData.connection.state ===
												ConnectionState.Disconnected,
										"text-foreground":
											voiceData.connection.quality ===
											ConnectionQuality.Unknown,
									}}
								>
									<Switch>
										<Match when={isReconnecting()}>Connecting...</Match>
										<Match
											when={
												voiceData.connection.state ===
												ConnectionState.Disconnected
											}
										>
											Voice Disconnected.
										</Match>
										<Match
											when={
												voiceData.connection.state === ConnectionState.Connected
											}
										>
											Voice Connected
										</Match>
									</Switch>
								</span>
								<Suspense>
									<span class="text-xs text-muted-foreground">
										{voiceData.connection.room?.name ??
											voiceData.connection.uri}
									</span>
								</Suspense>
							</div>
						</div>
						<Button
							variant="destructive"
							class="aspect-square"
							onClick={disconnect}
						>
							<PhoneSlashIcon />
						</Button>
					</div>
					<div class="grid grid-cols-4 gap-2 w-full">
						<Button
							class="w-full"
							variant={
								userPreferences.preferences().voice.input.enabled
									? "secondary"
									: "outline"
							}
							classList={{
								"text-(--primary-hover)!":
									userPreferences.preferences().voice.input.enabled,
								"text-red-400":
									!userPreferences.preferences().voice.input.enabled,
							}}
							onClick={toggleMic}
						>
							<Microphone
								enabled={userPreferences.preferences().voice.input.enabled}
							/>
						</Button>
						<Button
							class="w-full"
							variant={
								!userPreferences.preferences().voice.output.enabled
									? "secondary"
									: "outline"
							}
							classList={{
								"text-foreground":
									userPreferences.preferences().voice.output.enabled,
								"text-red-400!":
									!userPreferences.preferences().voice.output.enabled,
							}}
							onClick={toggleDeafen}
						>
							<Ear
								enabled={!userPreferences.preferences().voice.output.enabled}
							/>
						</Button>
						<Button
							class="w-full"
							variant={voiceData.states.camEnabled ? "secondary" : "outline"}
							classList={{
								"text-(--primary-hover)!": voiceData.states.camEnabled,
								"text-foreground": !voiceData.states.camEnabled,
							}}
							onClick={toggleCamera}
						>
							<Camera enabled={voiceData.states.camEnabled} />
						</Button>
						<Button
							class="w-full"
							variant={voiceData.states.screenEnabled ? "secondary" : "outline"}
							classList={{
								"text-(--primary-hover)!": voiceData.states.screenEnabled,
								"text-foreground": !voiceData.states.screenEnabled,
							}}
							onClick={toggleScreen}
						>
							<Screen enabled={voiceData.states.screenEnabled} />
						</Button>
					</div>
				</div>
			</Show>
			<div class="w-full h-16 flex items-center gap-3 p-3 bg-card">
				<Avatar user={user} />
				<div class="flex flex-col">
					<span class="font-bold leading-5">
						<User.DisplayableName color={false} user={user} />
					</span>
					<DropdownStatusSelect
						value={user.data.onlineState}
						setValue={(e) => {
							const next = typeof e === "string" ? e : e(onlineState());
							user.xrpc.social.colibri.actor.setState(next);
							user.updateActorData({ onlineState: next });
						}}
					>
						<div class="flex gap-2 items-center text-sm text-muted-foreground hover:underline cursor-pointer">
							{STATE_LABELS[user.data.onlineState]}
						</div>
					</DropdownStatusSelect>
				</div>
			</div>
		</div>
	);
};
