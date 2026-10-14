import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import type { DropdownMenuEntry } from "../DropdownMenu/DropdownMenu";
import {
	type DeveloperMenuActions,
	developerEntry,
	EntryContextMenu,
	markAsReadEntry,
	muteEntry,
	sectionEntries,
	type TargetContextMenuProps,
} from "./menu-entries";

export type ThreadMenuActions = DeveloperMenuActions & {
	following?: boolean;
	onFollowingChange?: (following: boolean) => void;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
	onMarkAsRead?: () => void;
	onCopyLink?: () => void;
	onRename?: () => void;
	onMove?: () => void;
	onDelete?: () => void;
};

export const threadMenuEntries = (
	actions: ThreadMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			label: "Notifications",
			items: [
				actions.onFollowingChange && {
					kind: "checkbox",
					label: "Follow thread",
					get icon() {
						return <EyeIcon />;
					},
					get checked() {
						return !!actions.following;
					},
					onChange: (checked: boolean) => actions.onFollowingChange?.(checked),
				},
				actions.onMarkAsRead && markAsReadEntry("single", actions.onMarkAsRead),
				actions.onMutedChange && muteEntry("thread", actions),
			],
		},
		{
			label: "Share",
			items: [
				actions.onCopyLink && {
					label: "Copy thread link",
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
				actions.onRename && {
					label: "Rename thread",
					get icon() {
						return <PenIcon />;
					},
					onSelect: actions.onRename,
				},
				actions.onMove && {
					label: "Move to channel",
					get icon() {
						return <ForwardIcon />;
					},
					onSelect: actions.onMove,
				},
			],
		},
		{ items: [developerEntry(actions)] },
		{
			items: [
				actions.onDelete && {
					label: "Delete thread",
					get icon() {
						return <TrashBinTrashIcon />;
					},
					tone: "destructive" as const,
					onSelect: actions.onDelete,
				},
			],
		},
	]);

export type ThreadContextMenuProps = ThreadMenuActions &
	TargetContextMenuProps & { name: string };

export const ThreadContextMenu = (props: ThreadContextMenuProps) => (
	<EntryContextMenu
		label={`${props.name} options`}
		entries={() => threadMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);
