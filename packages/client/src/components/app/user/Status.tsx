import type { OnlineState } from "@colibri-social/lib";
import {
	type Component,
	createSignal,
	Match,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import GearIcon from "~icons/ph/gear";
import PhoneSlashIcon from "~icons/ph/phone-slash";
import PictureInPictureIcon from "~icons/ph/picture-in-picture";
import { useCommunityContext } from "../../../contexts/Community";
import { useSettingsModalContext } from "../../../contexts/SettingsModal";
import { useUserContext } from "../../../contexts/User";
import {
	ConnectionQuality,
	ConnectionState,
	useVoiceChatContext,
} from "../../../contexts/VoiceChat";
import { Camera } from "../../icons/Camera";
import { Ear } from "../../icons/Ear";
import { Microphone } from "../../icons/Microphone";
import { Wifi } from "../../icons/Wifi";
import { Button } from "../../ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../ui/Tooltip";
import { UserSettingsModal } from "../settings";
import { ScreenShareButton } from "../voice/ScreenShareButton";
import User from ".";
import { Avatar } from "./Avatar";
import { ProfilePopover } from "./ProfilePopover";
import { QuickStatusDialog } from "./QuickStatusDialog";
import { SelfProfileActions } from "./SelfProfileActions";
import { STATE_LABELS } from "./StatusSelect";

/**
 * The user status visible in the community sidebar.
 */
export const Status: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const [statusDialogOpen, setStatusDialogOpen] = createSignal(false);
	const [
		voiceData,
		{ disconnect, toggleCamera, toggleMic, toggleDeafen, setOverlayDismissed },
	] = useVoiceChatContext();
	const settingsModal = useSettingsModalContext();

	const isReconnecting = () =>
		voiceData.connection.state === ConnectionState.Connecting ||
		voiceData.connection.state === ConnectionState.Reconnecting;

	const liveUser = () => community().members.find((m) => m.did === user.did);
	const onlineState = (): OnlineState =>
		liveUser()?.data.onlineState ?? user.data.onlineState;

	const voiceLabel = (): string =>
		[voiceData.connection.channelName, voiceData.connection.communityName]
			.filter(Boolean)
			.join(" / ");

	const qualityColorClass = (): string => {
		switch (voiceData.connection.quality) {
			case ConnectionQuality.Excellent:
				return "text-green-400!";
			case ConnectionQuality.Good:
				return "text-lime-400!";
			case ConnectionQuality.Poor:
			case ConnectionQuality.Lost:
				return "text-red-400!";
			default:
				return "text-foreground!";
		}
	};

	const latencyLabel = (): string =>
		voiceData.connection.latency != null
			? `${voiceData.connection.latency} ms`
			: "Measuring…";

	return (
		<div class="w-full h-fit flex flex-col">
			<Show when={voiceData.connection.state === ConnectionState.Connected}>
				<div class="w-full p-3 border-t border-border flex flex-col gap-2">
					<div class="flex flex-row items-center gap-2 justify-between">
						<div class="flex flex-row items-center gap-2 w-[calc(100%-40px)] overflow-hidden">
							<Tooltip placement="top">
								<TooltipTrigger
									as="div"
									class="min-w-8 h-8 bg-muted/50 flex items-center justify-center rounded-sm cursor-default"
									classList={{
										"bg-green-400/15":
											voiceData.connection.quality ===
											ConnectionQuality.Excellent,
										"bg-lime-400/15":
											voiceData.connection.quality === ConnectionQuality.Good,
										"bg-red-400/15":
											voiceData.connection.quality === ConnectionQuality.Poor,
										"bg-muted/50":
											voiceData.connection.quality ===
											ConnectionQuality.Unknown,
									}}
								>
									<Wifi size={24} quality={voiceData.connection.quality} />
								</TooltipTrigger>
								<TooltipPortal>
									<TooltipContent class={qualityColorClass()}>
										{latencyLabel()}
									</TooltipContent>
								</TooltipPortal>
							</Tooltip>
							<div class="flex flex-col w-[calc(100%-36px)] overflow-hidden">
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
									<span class="text-xs text-muted-foreground whitespace-nowrap text-ellipsis overflow-hidden">
										{voiceLabel()}
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
							variant={voiceData.states.micEnabled ? "secondary" : "outline"}
							classList={{
								"text-(--primary-hover)!": voiceData.states.micEnabled,
								"text-red-400": !voiceData.states.micEnabled,
							}}
							onClick={toggleMic}
						>
							<Microphone enabled={voiceData.states.micEnabled} />
						</Button>
						<Button
							class="w-full"
							variant={voiceData.states.deafened ? "secondary" : "outline"}
							classList={{
								"text-foreground": !voiceData.states.deafened,
								"text-red-400!": voiceData.states.deafened,
							}}
							onClick={toggleDeafen}
						>
							<Ear enabled={voiceData.states.deafened} />
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
						<ScreenShareButton class="w-full" />
					</div>
					<Show when={voiceData.overlayDismissed}>
						<Button
							variant="outline"
							class="w-full gap-2"
							onClick={() => setOverlayDismissed(false)}
						>
							<PictureInPictureIcon />
							<span>Show floating window</span>
						</Button>
					</Show>
				</div>
			</Show>
			<div class="w-full h-16 flex items-center gap-2 p-2 bg-card">
				<ProfilePopover
					user={liveUser() ?? user}
					placement="top"
					class="w-full max-w-[calc(100%-48px)] h-full"
					onEditStatus={() => setStatusDialogOpen(true)}
					actions={() => <SelfProfileActions />}
				>
					<div class="w-full h-full max-w-full overflow-hidden p-2 flex items-center gap-3 hover:bg-muted rounded-sm cursor-pointer">
						<Avatar user={liveUser() ?? user} class="size-8" />
						<div class="flex flex-col w-full max-w-[calc(100%-48px)]">
							<span class="font-bold leading-5">
								<User.DisplayableName color={false} user={liveUser() ?? user} />
							</span>
							<span class="text-xs text-muted-foreground">
								{STATE_LABELS[onlineState()]}
							</span>
						</div>
					</div>
				</ProfilePopover>
				<UserSettingsModal
					open={settingsModal.open}
					setOpen={settingsModal.setOpen}
					page={settingsModal.page}
					onPageConsumed={() => settingsModal.setPage(undefined)}
				>
					<div class="size-12 aspect-square flex rounded-md group/settings-btn hover:bg-muted items-center justify-center cursor-pointer">
						<div class="block w-fit h-fit text-lg group-hover/settings-btn:rotate-180 transition-transform duration-500">
							<GearIcon />
						</div>
					</div>
				</UserSettingsModal>
			</div>
			<QuickStatusDialog
				open={statusDialogOpen()}
				onOpenChange={setStatusDialogOpen}
			/>
		</div>
	);
};
