import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createSignal, For, type JSX, Show } from "solid-js";
import { AnimatedMicrophoneIcon } from "../../icons/animated/icons";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import { CallControlButton } from "./CallControls";
import {
	SpeakingAvatar,
	type VoiceParticipant,
	VoiceStateIcons,
} from "./shared";

export type VoiceParticipantRowProps = {
	participant: VoiceParticipant;
	class?: string;
};

export const VoiceParticipantRow = (props: VoiceParticipantRowProps) => (
	<li
		data-voice-participant=""
		data-speaking={props.participant.speaking ? "" : undefined}
		class={cx(
			"flex items-center gap-3 rounded-control bg-secondary py-2 pr-3 pl-2",
			props.class,
		)}
	>
		<SpeakingAvatar
			name={props.participant.name}
			src={props.participant.avatarSrc}
			presence={props.participant.presence}
			speaking={props.participant.speaking}
			size="base"
		/>
		<span class="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
			{props.participant.name}
			<Show when={props.participant.speaking}>
				<span class="sr-only">, speaking</span>
			</Show>
		</span>
		<VoiceStateIcons
			muted={props.participant.muted}
			deafened={props.participant.deafened}
			serverMuted={props.participant.serverMuted}
			serverDeafened={props.participant.serverDeafened}
			class="text-muted-foreground"
		/>
	</li>
);

export type VoiceSheetHeaderProps = {
	title: JSX.Element;
	onClose?: () => void;
	closeLabel?: string;
	onOpenSettings?: () => void;
	class?: string;
};

export const VoiceSheetHeader = (props: VoiceSheetHeaderProps) => (
	<div
		class={cx(
			"grid h-8 grid-cols-[32px_1fr_32px] items-center gap-2",
			props.class,
		)}
	>
		<Show when={props.onClose} fallback={<span aria-hidden="true" />}>
			<IconButton
				label={props.closeLabel ?? "Close"}
				icon={<CloseIcon />}
				size="md"
				variant="secondary"
				class="bg-muted [&_svg]:size-6"
				onClick={() => props.onClose?.()}
			/>
		</Show>
		<h2 class="m-0 truncate text-center text-base font-semibold text-foreground">
			{props.title}
		</h2>
		<Show when={props.onOpenSettings} fallback={<span aria-hidden="true" />}>
			<IconButton
				label="Voice settings"
				icon={<SettingsIcon />}
				size="md"
				variant="secondary"
				class="bg-muted [&_svg]:size-6"
				onClick={() => props.onOpenSettings?.()}
			/>
		</Show>
	</div>
);

export type VoiceJoinPanelProps = {
	channelName: string;
	participants?: VoiceParticipant[];
	joinMuted?: boolean;
	onJoinMutedChange?: (muted: boolean) => void;
	onJoin?: () => void;
	joining?: boolean;
	onOpenChat?: () => void;
	onOpenSettings?: () => void;
	onClose?: () => void;
	emptyText?: JSX.Element;
	class?: string;
};

const VoiceJoinBody = (props: VoiceJoinPanelProps) => {
	const participants = () => props.participants ?? [];
	return (
		<>
			<VoiceSheetHeader
				title={props.channelName}
				onClose={props.onClose}
				onOpenSettings={props.onOpenSettings}
			/>
			<Show
				when={participants().length}
				fallback={
					<p class="m-0 flex min-h-16 items-center justify-center text-center text-base text-pretty text-foreground">
						{props.emptyText ??
							"This voice channel is empty. Join to get the conversation started!"}
					</p>
				}
			>
				<ul
					aria-label={`In ${props.channelName}`}
					data-voice-join-list=""
					class="m-0 flex min-h-0 shrink list-none flex-col gap-2 overflow-y-auto overscroll-contain p-0"
				>
					<For each={participants()}>
						{(participant) => <VoiceParticipantRow participant={participant} />}
					</For>
				</ul>
			</Show>
		</>
	);
};

const VoiceJoinActions = (props: VoiceJoinPanelProps) => (
	<div data-voice-join-actions="" class="flex shrink-0 items-center gap-3">
		<CallControlButton
			label="Join muted"
			pressed={!!props.joinMuted}
			tone={props.joinMuted ? "off" : "default"}
			icon={<AnimatedMicrophoneIcon muted={!!props.joinMuted} />}
			onClick={() => props.onJoinMutedChange?.(!props.joinMuted)}
		/>
		<Button
			variant="primary"
			block
			loading={props.joining}
			class="h-12 min-w-0 flex-1 rounded-control-lg"
			onClick={() => props.onJoin?.()}
		>
			Join voice
		</Button>
		<Show when={props.onOpenChat}>
			<CallControlButton
				label="Open chat"
				icon={<ChatRoundDotsIcon />}
				onClick={props.onOpenChat}
			/>
		</Show>
	</div>
);

export const VoiceJoinPanel = (props: VoiceJoinPanelProps) => (
	<div
		data-voice-join=""
		class={cx("flex min-h-0 flex-col gap-4 pt-2", props.class)}
	>
		<VoiceJoinBody {...props} />
		<VoiceJoinActions {...props} />
	</div>
);

export type VoiceJoinDrawerProps = VoiceJoinPanelProps & {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	initialOpen?: boolean;
};

export const VoiceJoinDrawer = (props: VoiceJoinDrawerProps) => {
	const [localOpen, setLocalOpen] = createSignal(props.initialOpen ?? false);
	const open = () => props.open ?? localOpen();
	const setOpen = (next: boolean) => {
		setLocalOpen(next);
		props.onOpenChange?.(next);
	};
	return (
		<Drawer open={open()} onOpenChange={setOpen}>
			<DrawerContent
				aria-label={`Join ${props.channelName}`}
				footer={<VoiceJoinActions {...props} />}
			>
				<div
					data-voice-join=""
					class={cx("flex flex-col gap-4 pt-2", props.class)}
				>
					<VoiceJoinBody
						{...props}
						onClose={props.onClose ?? (() => setOpen(false))}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
};
