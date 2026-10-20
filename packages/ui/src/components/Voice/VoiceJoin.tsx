import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createSignal, type JSX, Show, untrack } from "solid-js";
import { AnimatedMicrophoneIcon } from "../../icons/animated/icons";
import { cx } from "../../utils/cx";
import { createMenuTrigger } from "../../utils/gestures";
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
import {
	VoiceGrid,
	type VoiceGridProps,
	type VoiceTileData,
} from "./VoiceGrid";

export type VoiceParticipantRowProps = {
	participant: VoiceParticipant;
	onOpen?: (id: string) => void;
	onMenu?: (id: string) => void;
	wrap?: (row: JSX.Element) => JSX.Element;
	class?: string;
};

const wrapRow = (
	wrap: ((row: JSX.Element) => JSX.Element) | undefined,
	row: JSX.Element,
) => (wrap ? untrack(() => wrap(row)) : row);

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
		ref={(element) =>
			createMenuTrigger(element, {
				enabled: () => !!props.onMenu && !props.participant.pending,
				onMenu: () => props.onMenu?.(props.participant.id),
			})
		}
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
			{wrapRow(
				props.wrap,
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
				</Show>,
			)}
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
	joinDisabled?: boolean;
	joinDisabledReason?: JSX.Element;
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
	onParticipantMenu?: (id: string) => void;
	participantMenu?: (
		participant: VoiceParticipant,
		row: JSX.Element,
	) => JSX.Element;
	emptyText?: JSX.Element;
	joinDisabled?: boolean;
};

const emptyFallback = (joinDisabled?: boolean) =>
	joinDisabled
		? "This voice channel is empty."
		: "This voice channel is empty. Join to get the conversation started!";

const JOIN_DISABLED_TEXT = "You can't join this voice channel.";

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
					{props.emptyText ?? emptyFallback(props.joinDisabled)}
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
							onMenu={props.onParticipantMenu}
							wrap={
								props.participantMenu
									? (row) => props.participantMenu?.(participant(), row)
									: undefined
							}
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
			joinDisabled={props.joinDisabled}
		/>
	</>
);

export type VoiceJoinActionsProps = Pick<
	VoiceJoinPanelProps,
	| "joinMuted"
	| "onJoinMutedChange"
	| "onJoin"
	| "joining"
	| "joinDisabled"
	| "joinDisabledReason"
	| "onOpenChat"
	| "chatOpen"
>;

export const VoiceJoinActions = (props: VoiceJoinActionsProps) => (
	<div data-voice-join-actions="" class="flex shrink-0 items-center gap-4">
		<Show
			when={!props.joinDisabled}
			fallback={
				<p
					data-voice-join-disabled=""
					class="m-0 flex min-h-12 min-w-0 flex-1 items-center text-sm text-pretty text-muted-foreground"
				>
					{props.joinDisabledReason ?? JOIN_DISABLED_TEXT}
				</p>
			}
		>
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
		</Show>
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

export const voicePresenceText = (participants: VoiceParticipant[]) => {
	const names = participants
		.filter((participant) => !participant.pending)
		.map((participant) => participant.name);
	const others = participants.length - Math.min(names.length, 2);
	const shown = names.slice(0, 2);
	if (participants.length === 0) return undefined;
	if (shown.length === 0)
		return participants.length === 1
			? "1 person is here."
			: `${participants.length} people are here.`;
	if (others === 0)
		return shown.length === 1
			? `${shown[0]} is here.`
			: `${shown[0]} and ${shown[1]} are here.`;
	return `${shown.join(", ")} and ${others} ${others === 1 ? "other" : "others"} are here.`;
};

export type VoiceJoinPromptProps = {
	channelName: string;
	participants?: VoiceParticipant[];
	emptyText?: JSX.Element;
	onJoin?: () => void;
	joining?: boolean;
	joinDisabled?: boolean;
	joinDisabledReason?: JSX.Element;
	class?: string;
};

export const VoiceJoinPrompt = (props: VoiceJoinPromptProps) => (
	<div
		data-voice-join=""
		data-voice-join-prompt=""
		class={cx(
			"flex w-full max-w-[400px] flex-col items-center gap-4 text-center",
			props.class,
		)}
	>
		<div class="flex flex-col gap-1">
			<h2 class="m-0 text-lg font-semibold break-words text-foreground">
				{props.channelName}
			</h2>
			<p
				data-voice-join-text=""
				class="m-0 text-base text-pretty text-muted-foreground"
			>
				{voicePresenceText(props.participants ?? []) ??
					props.emptyText ??
					emptyFallback(props.joinDisabled)}
			</p>
		</div>
		<Show
			when={!props.joinDisabled}
			fallback={
				<p
					data-voice-join-disabled=""
					class="m-0 text-sm text-pretty text-muted-foreground"
				>
					{props.joinDisabledReason ?? JOIN_DISABLED_TEXT}
				</p>
			}
		>
			<Button
				variant="primary"
				loading={props.joining}
				onClick={() => props.onJoin?.()}
			>
				Join voice
			</Button>
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
	tileMenu?: VoiceGridProps["tileMenu"];
	onTileMenu?: VoiceGridProps["onTileMenu"];
	class?: string;
};

export const VoiceStage = (props: VoiceStageProps) => (
	<div data-voice-stage="" class={cx("min-h-0 flex-1", props.class)}>
		<VoiceGrid
			portrait={props.portrait ?? true}
			tiles={props.tiles}
			focusedKey={props.focusedKey}
			onFocusChange={props.onFocusChange}
			tileMenu={props.tileMenu}
			onTileMenu={props.onTileMenu}
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
				joinDisabled={props.joinDisabled}
			/>
		</VoiceDrawer>
	);
};
