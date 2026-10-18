import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
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

export type CategoryMenuActions = DeveloperMenuActions & {
	onMarkAsRead?: () => void;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
	onEdit?: () => void;
	onCreateChannel?: () => void;
	onDelete?: () => void;
};

export const categoryMenuEntries = (
	actions: CategoryMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			label: "Notifications",
			items: [
				actions.onMarkAsRead && markAsReadEntry("group", actions.onMarkAsRead),
				actions.onMutedChange && muteEntry("category", actions),
			],
		},
		{
			label: "Manage",
			items: [
				actions.onEdit && {
					label: "Edit category",
					get icon() {
						return <SettingsIcon />;
					},
					onSelect: actions.onEdit,
				},
				actions.onCreateChannel && {
					label: "Create channel",
					get icon() {
						return <AddCircleIcon />;
					},
					onSelect: actions.onCreateChannel,
				},
			],
		},
		{ items: [developerEntry(actions)] },
		{
			items: [
				actions.onDelete && {
					label: "Delete category",
					get icon() {
						return <TrashBinTrashIcon />;
					},
					tone: "destructive",
					onSelect: actions.onDelete,
				},
			],
		},
	]);

export type CategoryContextMenuProps = CategoryMenuActions &
	TargetContextMenuProps & { name: string };

export const CategoryContextMenu = (props: CategoryContextMenuProps) => (
	<EntryContextMenu
		label={`${props.name} options`}
		entries={() => categoryMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);
