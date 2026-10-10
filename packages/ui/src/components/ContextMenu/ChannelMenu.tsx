import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { DocumentsIcon } from "@solar-icons/solid/bold/documents";
import { EndCallRoundedIcon } from "@solar-icons/solid/bold/end-call-rounded";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { PhoneIcon } from "@solar-icons/solid/bold/phone";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { ThreadIcon } from "../../icons/custom";
import type {
	DropdownMenuEntry,
	DropdownMenuItemEntry,
} from "../DropdownMenu/DropdownMenu";
import {
	type DeveloperMenuActions,
	developerEntry,
	EntryContextMenu,
	markAsReadEntry,
	muteEntry,
	sectionEntries,
	type TargetContextMenuProps,
} from "./menu-entries";

type ChannelManageActions = DeveloperMenuActions & {
	onCopyLink?: () => void;
	onDuplicate?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
};

const manageSections = (actions: ChannelManageActions) => [
	{
		label: "Share",
		items: [
			actions.onCopyLink && {
				label: "Copy channel link",
				get icon() {
					return <LinkIcon />;
				},
				onSelect: actions.onCopyLink,
			},
		],
	},
	{
		label: "Manage",
		items: [
			actions.onDuplicate && {
				label: "Duplicate",
				get icon() {
					return <DocumentsIcon />;
				},
				onSelect: actions.onDuplicate,
			},
			actions.onEdit && {
				label: "Edit channel",
				get icon() {
					return <SettingsIcon />;
				},
				onSelect: actions.onEdit,
			},
		],
	},
	{ items: [developerEntry(actions)] },
	{
		items: [
			actions.onDelete && {
				label: "Delete channel",
				get icon() {
					return <TrashBinTrashIcon />;
				},
				tone: "destructive" as const,
				onSelect: actions.onDelete,
			},
		],
	},
];

export type ChannelMenuActions = ChannelManageActions & {
	onMarkAsRead?: () => void;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
	onStartThread?: () => void;
	onShowThreads?: () => void;
};

export const channelMenuEntries = (
	actions: ChannelMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			label: "Notifications",
			items: [
				actions.onMarkAsRead && markAsReadEntry("single", actions.onMarkAsRead),
				actions.onMutedChange && muteEntry("channel", actions),
			],
		},
		{
			label: "Threads",
			items: [
				actions.onStartThread && {
					label: "Start a thread",
					get icon() {
						return <ThreadIcon />;
					},
					onSelect: actions.onStartThread,
				},
				actions.onShowThreads && {
					label: "Show all threads",
					get icon() {
						return <ChatRoundDotsIcon />;
					},
					onSelect: actions.onShowThreads,
				},
			],
		},
		...manageSections(actions),
	]);

export type ChannelContextMenuProps = ChannelMenuActions &
	TargetContextMenuProps & { name: string };

export const ChannelContextMenu = (props: ChannelContextMenuProps) => (
	<EntryContextMenu
		label={`${props.name} options`}
		entries={() => channelMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);

export type VoiceChannelMenuActions = ChannelManageActions & {
	connected?: boolean;
	onConnectedChange?: (connected: boolean) => void;
};

const voiceEntry = (
	actions: VoiceChannelMenuActions,
): DropdownMenuItemEntry => ({
	get label() {
		return actions.connected ? "Leave voice" : "Join voice";
	},
	get icon() {
		return actions.connected ? <EndCallRoundedIcon /> : <PhoneIcon />;
	},
	onSelect: () => actions.onConnectedChange?.(!actions.connected),
});

export const voiceChannelMenuEntries = (
	actions: VoiceChannelMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			label: "Voice",
			items: [actions.onConnectedChange && voiceEntry(actions)],
		},
		...manageSections(actions),
	]);

export type VoiceChannelContextMenuProps = VoiceChannelMenuActions &
	TargetContextMenuProps & { name: string };

export const VoiceChannelContextMenu = (
	props: VoiceChannelContextMenuProps,
) => (
	<EntryContextMenu
		label={`${props.name} options`}
		entries={() => voiceChannelMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);
