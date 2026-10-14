import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createSignal, type JSX, Show } from "solid-js";
import { AnimatedMicrophoneIcon } from "../../icons/animated/icons";
import { cx } from "../../utils/cx";
import { KeyedFor } from "../../utils/keyed";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import { SkeletonCircle, SkeletonText } from "../Skeleton/Skeleton";
import { CallControlButton, chatToggleProps } from "./CallControls";
import {
	SpeakingAvatar,
	type VoiceParticipant,
	VoiceStateIcons,
} from "./shared";
import { VoiceGrid, type VoiceTileData } from "./VoiceGrid";

export type VoiceParticipantRowProps = {
	participant: VoiceParticipant;
	onOpen?: (id: string) => void;
	class?: string;
};

const participantRowClass =
	"flex w-full min-w-0 items-center gap-3 rounded-control bg-secondary py-2 pr-3 pl-2";

const VoiceParticipantContent = (props: { participant: VoiceParticipant }) => (
	<>
		<SpeakingAvatar
			name={props.participant.name}
			seed={props.participant.id}
			src={props.participant.avatarSrc}
			presence={props.participant.presence}
			size="base"
		/>
		<span class="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
			{props.participant.name}
		</span>
		<VoiceStateIcons
			muted={props.participant.muted}
			deafened={props.participant.deafened}
			serverMuted={props.participant.serverMuted}
			serverDeafened={props.participant.serverDeafened}
			class="text-muted-foreground"
		/>
	</>
);

export const VoiceParticipantRow = (props: VoiceParticipantRowProps) => (
	<li
		data-voice-participant=""
		data-pending={props.participant.pending || undefined}
		class={cx("flex min-w-0", props.class)}
	>
		<Show
			when={!props.participant.pending}
			fallback={
				<span class={participantRowClass}>
					<SkeletonCircle size={32} />
					<span class="min-w-0 flex-1">
						<SkeletonText size="base" width="40%" />
					</span>
					<span class="sr-only">Loading participant</span>
				</span>
			}
		>
			<Show
				when={props.onOpen}
				fallback={
					<span class={participantRowClass}>
						<VoiceParticipantContent participant={props.participant} />
					</span>
				}
			>
				{(open) => (
					<button
						type="button"
						onClick={() => open()(props.participant.id)}
						class={cx(
							participantRowClass,
							"cursor-pointer border-0 text-left outline-none focus-ring-inset hover:bg-popover-highlight",
						)}
					>
						<VoiceParticipantContent participant={props.participant} />
					</button>
				)}
			</Show>
		</Show>
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
	onOpenParticipant?: (id: string) => void;
	joinMuted?: boolean;
	onJoinMutedChange?: (muted: boolean) => void;
	onJoin?: () => void;
	joining?: boolean;
	onOpenChat?: () => void;
	chatOpen?: boolean;
	onOpenSettings?: () => void;
	onClose?: () => void;
	emptyText?: JSX.Element;
	class?: string;
};

export type VoiceJoinRosterProps = {
	channelName: string;
	participants?: VoiceParticipant[];
	onOpenParticipant?: (id: string) => void;
	emptyText?: JSX.Element;
};

export const VoiceJoinRoster = (props: VoiceJoinRosterProps) => {
	const participants = () => props.participants ?? [];
	return (
		<Show
			when={participants().length}
			fallback={
				<p
					data-voice-join-empty=""
					class="m-0 flex min-h-16 items-center justify-center text-center text-base text-pretty text-foreground"
				>
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
				<KeyedFor each={participants()} by={(participant) => participant.id}>
					{(participant) => (
						<VoiceParticipantRow
							participant={participant()}
							onOpen={props.onOpenParticipant}
						/>
					)}
				</KeyedFor>
			</ul>
		</Show>
	);
};

const VoiceJoinBody = (props: VoiceJoinPanelProps) => (
	<>
		<VoiceSheetHeader
			title={props.channelName}
			onClose={props.onClose}
			onOpenSettings={props.onOpenSettings}
		/>
		<VoiceJoinRoster
			channelName={props.channelName}
			participants={props.participants}
			onOpenParticipant={props.onOpenParticipant}
			emptyText={props.emptyText}
		/>
	</>
);

export type VoiceJoinActionsProps = Pick<
	VoiceJoinPanelProps,
	| "joinMuted"
	| "onJoinMutedChange"
	| "onJoin"
	| "joining"
	| "onOpenChat"
	| "chatOpen"
>;

export const VoiceJoinActions = (props: VoiceJoinActionsProps) => (
	<div data-voice-join-actions="" class="flex shrink-0 items-center gap-4">
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
				label={chatToggleProps(props.chatOpen).label}
				pressed={chatToggleProps(props.chatOpen).pressed}
				tone={chatToggleProps(props.chatOpen).tone}
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

export type VoiceStageProps = {
	tiles: VoiceTileData[];
	portrait?: boolean;
	focusedKey?: string | null;
	onFocusChange?: (key: string | null) => void;
	class?: string;
};

export const VoiceStage = (props: VoiceStageProps) => (
	<div data-voice-stage="" class={cx("min-h-0 flex-1", props.class)}>
		<VoiceGrid
			portrait={props.portrait ?? true}
			tiles={props.tiles}
			focusedKey={props.focusedKey}
			onFocusChange={props.onFocusChange}
		/>
	</div>
);

export type VoiceDrawerProps = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	initialOpen?: boolean;
	label: string;
	joined?: boolean;
	header: JSX.Element;
	footer: JSX.Element;
	children?: JSX.Element;
	class?: string;
};

export const VoiceDrawer = (props: VoiceDrawerProps) => {
	const [localOpen, setLocalOpen] = createSignal(props.initialOpen ?? false);
	const open = () => props.open ?? localOpen();
	const setOpen = (next: boolean) => {
		setLocalOpen(next);
		props.onOpenChange?.(next);
	};
	return (
		<Drawer open={open()} onOpenChange={setOpen}>
			<DrawerContent
				aria-label={props.label}
				handle={false}
				fill={!!props.joined}
				footer={props.footer}
			>
				<div
					data-voice-drawer=""
					data-joined={props.joined ? "" : undefined}
					class={cx(
						"flex min-h-0 flex-col gap-4",
						props.joined && "flex-1",
						props.class,
					)}
				>
					{props.header}
					{props.children}
				</div>
			</DrawerContent>
		</Drawer>
	);
};

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
		<VoiceDrawer
			open={open()}
			onOpenChange={setOpen}
			label={`Join ${props.channelName}`}
			class={props.class}
			header={
				<VoiceSheetHeader
					title={props.channelName}
					onClose={props.onClose ?? (() => setOpen(false))}
					onOpenSettings={props.onOpenSettings}
				/>
			}
			footer={<VoiceJoinActions {...props} />}
		>
			<VoiceJoinRoster
				channelName={props.channelName}
				participants={props.participants}
				emptyText={props.emptyText}
			/>
		</VoiceDrawer>
	);
};
