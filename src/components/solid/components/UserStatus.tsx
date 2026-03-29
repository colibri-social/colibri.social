import { ConnectionQuality, ConnectionState } from "livekit-client";
import {
	type Accessor,
	type Component,
	createEffect,
	createMemo,
	createSignal,
	Match,
	type ParentComponent,
	type Setter,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { Icon } from "@/components/solid/icons/Icon";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/solid/shadcn-solid/DropdownMenu";
import { useGlobalContext } from "../contexts/GlobalContext";
import type { UserOnlineState } from "../contexts/GlobalContext/events";
import { usePreferencesContext } from "../contexts/UserPreferencesContext";
import { useVoiceChatContext } from "../contexts/VoiceChatContext";
import { Camera } from "../icons/Camera";
import { Ear } from "../icons/Ear";
import { Microphone } from "../icons/Microphone";
import { Screen } from "../icons/Screen";
import { Wifi } from "../icons/Wifi";
import { Button } from "../shadcn-solid/Button";
import User from './User'

const LABEL_MAP: Record<UserOnlineState, string> = {
	online: "Online",
	away: "Away",
	dnd: "Do Not Disturb",
	offline: "Offline",
};

const DropdownStatusSelect: ParentComponent<{
	value: Accessor<UserOnlineState>;
	setValue: Setter<UserOnlineState>;
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
						<DropdownMenuRadioGroup value={props.value()}>
							<DropdownMenuRadioItem
								value="online"
								onSelect={() => props.setValue("online")}
								class="[&_svg]:text-green-400"
							>
								{LABEL_MAP.online}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="away"
								onSelect={() => props.setValue("away")}
								class="[&_svg]:text-yellow-400"
							>
								{LABEL_MAP.away}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="dnd"
								onSelect={() => props.setValue("dnd")}
								class="[&_svg]:text-red-400"
							>
								{LABEL_MAP.dnd}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="offline"
								onSelect={() => props.setValue("offline")}
								class="[&_svg]:text-neutral-400"
							>
								{LABEL_MAP.offline}
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
export const UserStatus: Component = () => {
	const [value, setValue] = createSignal<UserOnlineState>("online");
	const [userPreferences] = usePreferencesContext();
	const [globalData, { sendSocketMessage }] = useGlobalContext();
	const [
		voiceData,
		{ disconnect, toggleMic, toggleCamera, toggleScreen, toggleDeafen },
	] = useVoiceChatContext();

	const optimisticUserProfile = createMemo(() => {
		const optimisticProfileUpdates = globalData.memberProfileOverrides.find(
			(x) => x.did === globalData.user.sub,
		);
		const optimisticStatusUpdates = globalData.memberStatusOverrides.find(
			(x) => x.did === globalData.user.sub,
		);

		return {
			avatar_url:
				optimisticProfileUpdates?.avatar_url || globalData.user.avatar,
			banner_url:
				optimisticProfileUpdates?.banner_url || globalData.user.banner,
			display_name:
				optimisticProfileUpdates?.display_name || globalData.user.displayName,
			state: optimisticStatusUpdates?.state || "online",
		};
	});

	createEffect(() => {
		const state = value();

		sendSocketMessage({
			action: "set_state",
			state: state,
		});
	});

	const isReconnecting = () =>
		voiceData.connection.state === ConnectionState.Connecting ||
		voiceData.connection.state === ConnectionState.Reconnecting ||
		voiceData.connection.state === ConnectionState.SignalReconnecting;

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
									class="text-sm text-medium"
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
											voiceData.connection.rkey}
									</span>
								</Suspense>
							</div>
						</div>
						<Button
							variant="destructive"
							class="aspect-square"
							onClick={disconnect}
						>
							<Icon variant="regular" name="phone-slash-icon" />
						</Button>
					</div>
					<div class="grid grid-cols-4 gap-2 w-full">
						<Button
							class="w-full"
							variant={
								userPreferences.voice.input.enabled ? "secondary" : "outline"
							}
							classList={{
								"text-(--primary-hover)!": userPreferences.voice.input.enabled,
								"text-red-400": !userPreferences.voice.input.enabled,
							}}
							onClick={toggleMic}
						>
							<Microphone enabled={userPreferences.voice.input.enabled} />
						</Button>
						<Button
							class="w-full"
							variant={
								!userPreferences.voice.output.enabled ? "secondary" : "outline"
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
				<User.Avatar user={optimisticUserProfile()} state={optimisticUserProfile().state} />
				<div class="flex flex-col">
					<span class="font-bold leading-5">
						{optimisticUserProfile().display_name}
					</span>
					<DropdownStatusSelect value={value} setValue={setValue}>
						<div class="flex gap-2 items-center text-sm text-muted-foreground hover:underline cursor-pointer">
							{LABEL_MAP[optimisticUserProfile().state]}
						</div>
					</DropdownStatusSelect>
				</div>
			</div>
		</div>
	);
};
