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
import { useVoiceChatContext } from "../contexts/VoiceChatContext";
import { Camera } from "../icons/Camera";
import { Ear } from "../icons/Ear";
import { Microphone } from "../icons/Microphone";
import { Screen } from "../icons/Screen";
import { Wifi } from "../icons/Wifi";
import { Button } from "../shadcn-solid/Button";

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
		voiceData.connectionState === ConnectionState.Connecting ||
		voiceData.connectionState === ConnectionState.Reconnecting ||
		voiceData.connectionState === ConnectionState.SignalReconnecting;

	return (
		<div class="w-full h-fit flex flex-col">
			<Show when={voiceData.connectionState === ConnectionState.Connected}>
				<div class="w-full p-3 border-t border-border flex flex-col gap-2">
					<div class="flex flex-row items-center gap-2 justify-between">
						<div class="flex flex-row items-center gap-2">
							<div
								class="w-8 h-8 bg-muted/50 flex items-center justify-center rounded-sm"
								classList={{
									"bg-green-400/15":
										voiceData.connectionQuality === ConnectionQuality.Excellent,
									"bg-lime-400/15":
										voiceData.connectionQuality === ConnectionQuality.Good,
									"bg-red-400/15":
										voiceData.connectionQuality === ConnectionQuality.Poor,
									"bg-muted/50":
										voiceData.connectionQuality === ConnectionQuality.Unknown,
								}}
							>
								<Wifi size={24} quality={voiceData.connectionQuality} />
							</div>
							<div class="flex flex-col w-fit">
								<span
									class="text-sm text-medium"
									classList={{
										"text-green-400":
											voiceData.connectionQuality ===
											ConnectionQuality.Excellent,
										"text-lime-400":
											voiceData.connectionQuality === ConnectionQuality.Good,
										"text-yellow-400!": isReconnecting(),
										"text-red-400!":
											voiceData.connectionQuality === ConnectionQuality.Poor ||
											voiceData.connectionState ===
												ConnectionState.Disconnected,
										"text-foreground":
											voiceData.connectionQuality === ConnectionQuality.Unknown,
									}}
								>
									<Switch>
										<Match when={isReconnecting()}>Connecting...</Match>
										<Match
											when={
												voiceData.connectionState ===
												ConnectionState.Disconnected
											}
										>
											Voice Disconnected.
										</Match>
										<Match
											when={
												voiceData.connectionState === ConnectionState.Connected
											}
										>
											Voice Connected
										</Match>
									</Switch>
								</span>
								<Suspense>
									<span class="text-xs text-muted-foreground">
										{voiceData.activeRoomName!}
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
							variant={voiceData.micEnabled ? "secondary" : "outline"}
							classList={{
								"text-(--primary-hover)!": voiceData.micEnabled,
								"text-red-400": !voiceData.micEnabled,
							}}
							onClick={toggleMic}
						>
							<Microphone enabled={voiceData.micEnabled} />
						</Button>
						<Button
							class="w-full"
							variant={voiceData.isDeafened ? "secondary" : "outline"}
							classList={{
								"text-foreground": !voiceData.isDeafened,
								"text-red-400!": voiceData.isDeafened,
							}}
							onClick={toggleDeafen}
						>
							<Ear enabled={voiceData.isDeafened} />
						</Button>
						<Button
							class="w-full"
							variant={voiceData.camEnabled ? "secondary" : "outline"}
							classList={{
								"text-(--primary-hover)!": voiceData.camEnabled,
								"text-foreground": !voiceData.camEnabled,
							}}
							onClick={toggleCamera}
						>
							<Camera enabled={voiceData.camEnabled} />
						</Button>
						<Button
							class="w-full"
							variant={voiceData.screenEnabled ? "secondary" : "outline"}
							classList={{
								"text-(--primary-hover)!": voiceData.screenEnabled,
								"text-foreground": !voiceData.screenEnabled,
							}}
							onClick={toggleScreen}
						>
							<Screen enabled={voiceData.screenEnabled} />
						</Button>
					</div>
				</div>
			</Show>
			<div class="w-full h-16 flex flex-row gap-3 p-3 bg-card">
				<img
					src={optimisticUserProfile().avatar_url || "/user-placeholder.png"}
					alt={optimisticUserProfile().display_name}
					class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
				/>
				<div class="flex flex-col">
					<span class="font-bold leading-5">
						{optimisticUserProfile().display_name}
					</span>
					<DropdownStatusSelect value={value} setValue={setValue}>
						<div class="flex gap-2 items-center hover:underline cursor-pointer">
							<div
								class="w-2 h-2 min-w-2 min-h-2 rounded-full"
								classList={{
									"bg-green-400": optimisticUserProfile().state === "online",
									"bg-yellow-400": optimisticUserProfile().state === "away",
									"bg-red-400": optimisticUserProfile().state === "dnd",
									"bg-neutral-400": optimisticUserProfile().state === "offline",
								}}
							/>
							<span class="text-sm text-muted-foreground">
								{LABEL_MAP[optimisticUserProfile().state]}
							</span>
						</div>
					</DropdownStatusSelect>
				</div>
			</div>
		</div>
	);
};
