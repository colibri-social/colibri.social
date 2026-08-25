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
import { activitySummary, liveActivityOf } from "../../../atproto/activity";
import type { ProfileView } from "../../../atproto/views";
import { useCommunityContext } from "../../../contexts/Community";
import { normalizeOnlineState } from "../../../contexts/community-payload";
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
import { ActivityIcon } from "./ActivityCard";
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

	const micTransmitting = () =>
		voiceData.states.micEnabled && !voiceData.states.serverMuted;

	const audioSilenced = () =>
		voiceData.states.deafened || voiceData.states.serverDeafened;

	const liveMember = () => community().members.find((m) => m.did === user.did);
	const liveUser = (): ProfileView => liveMember()?.actor ?? user;
	const onlineState = (): OnlineState =>
		liveMember()?.data.onlineState ??
		normalizeOnlineState(user.presence?.onlineState);

	const activity = () =>
		liveMember()?.data.activity ?? liveActivityOf(user.presence);

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
			<Show when={voiceData.connection.state !== ConnectionState.Disconnected}>
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
						<Tooltip placement="top">
							<TooltipTrigger class="w-full">
								<Button
									class="w-full"
									variant={micTransmitting() ? "secondary" : "outline"}
									classList={{
										"text-amber-500!": voiceData.states.serverMuted,
										"text-(--primary-hover)!": micTransmitting(),
										"text-red-400":
											!voiceData.states.serverMuted &&
											!voiceData.states.micEnabled,
									}}
									disabled={voiceData.states.serverMuted}
									onClick={toggleMic}
								>
									<Microphone enabled={micTransmitting()} />
								</Button>
							</TooltipTrigger>
							<Show when={voiceData.states.serverMuted}>
								<TooltipPortal>
									<TooltipContent>
										A moderator muted you. Your mic stays muted until they lift
										it.
									</TooltipContent>
								</TooltipPortal>
							</Show>
						</Tooltip>
						<Tooltip placement="top">
							<TooltipTrigger class="w-full">
								<Button
									class="w-full"
									variant={audioSilenced() ? "secondary" : "outline"}
									classList={{
										"text-amber-500!": voiceData.states.serverDeafened,
										"text-foreground": !audioSilenced(),
										"text-red-400!":
											!voiceData.states.serverDeafened &&
											voiceData.states.deafened,
									}}
									disabled={voiceData.states.serverDeafened}
									onClick={toggleDeafen}
								>
									<Ear enabled={audioSilenced()} />
								</Button>
							</TooltipTrigger>
							<Show when={voiceData.states.serverDeafened}>
								<TooltipPortal>
									<TooltipContent>
										A moderator deafened you. You stay deafened until they lift
										it.
									</TooltipContent>
								</TooltipPortal>
							</Show>
						</Tooltip>
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
					user={liveUser()}
					placement="top"
					class="w-full max-w-[calc(100%-48px-8px)] h-full"
					onEditStatus={() => setStatusDialogOpen(true)}
					actions={() => <SelfProfileActions />}
				>
					<div class="w-full h-full max-w-full overflow-hidden p-2 flex items-center gap-3 hover:bg-muted rounded-sm cursor-pointer">
						<Avatar user={liveUser()} class="size-8" />
						<div class="flex flex-col w-full max-w-[calc(100%-48px)]">
							<span class="font-bold leading-5">
								<User.DisplayableName color={false} user={liveUser()} />
							</span>
							<Show
								when={activity()}
								fallback={
									<span class="text-xs text-muted-foreground">
										{STATE_LABELS[onlineState()]}
									</span>
								}
							>
								<span class="text-xs text-muted-foreground flex flex-row items-center gap-1 max-w-full overflow-hidden">
									<span class="text-purple-400 shrink-0">
										<ActivityIcon kind={activity()!.kind} />
									</span>
									<span class="whitespace-nowrap text-ellipsis overflow-hidden">
										{activitySummary(activity()!)}
									</span>
								</span>
							</Show>
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
