import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { AddFolderIcon } from "@solar-icons/solid/bold/add-folder";
import { BellIcon } from "@solar-icons/solid/bold/bell";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { SortVerticalIcon } from "@solar-icons/solid/bold/sort-vertical";
import { UserPlusRoundedIcon } from "@solar-icons/solid/bold/user-plus-rounded";
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

export type SpaceContextMenuActions = DeveloperMenuActions & {
	onInvite?: () => void;
	onOpenSettings?: () => void;
	onOpenNotificationSettings?: () => void;
	onMarkAsRead?: () => void;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
	onCreateChannel?: () => void;
	onCreateCategory?: () => void;
	onReorderChannels?: () => void;
	onLeave?: () => void;
};

export const spaceContextMenuEntries = (
	actions: SpaceContextMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			label: "Space",
			items: [
				actions.onInvite && {
					label: "Invite people",
					get icon() {
						return <UserPlusRoundedIcon />;
					},
					onSelect: actions.onInvite,
				},
				actions.onOpenSettings && {
					label: "Space settings",
					get icon() {
						return <SettingsIcon />;
					},
					onSelect: actions.onOpenSettings,
				},
				actions.onOpenNotificationSettings && {
					label: "Notification settings",
					get icon() {
						return <BellIcon />;
					},
					onSelect: actions.onOpenNotificationSettings,
				},
			],
		},
		{
			label: "Notifications",
			items: [
				actions.onMarkAsRead && markAsReadEntry("group", actions.onMarkAsRead),
				actions.onMutedChange && muteEntry("Space", actions),
			],
		},
		{
			label: "Channels",
			items: [
				actions.onCreateChannel && {
					label: "Create channel",
					get icon() {
						return <AddCircleIcon />;
					},
					onSelect: actions.onCreateChannel,
				},
				actions.onCreateCategory && {
					label: "Create category",
					get icon() {
						return <AddFolderIcon />;
					},
					onSelect: actions.onCreateCategory,
				},
				actions.onReorderChannels && {
					label: "Reorder channels",
					get icon() {
						return <SortVerticalIcon />;
					},
					onSelect: actions.onReorderChannels,
				},
			],
		},
		{ items: [developerEntry(actions)] },
		{
			items: [
				actions.onLeave && {
					label: "Leave Space",
					get icon() {
						return <Logout2Icon />;
					},
					tone: "destructive",
					onSelect: actions.onLeave,
				},
			],
		},
	]);

export type SpaceContextMenuProps = SpaceContextMenuActions &
	TargetContextMenuProps & { name: string };

export const SpaceContextMenu = (props: SpaceContextMenuProps) => (
	<EntryContextMenu
		label={`${props.name}, Space options`}
		entries={() => spaceContextMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);
