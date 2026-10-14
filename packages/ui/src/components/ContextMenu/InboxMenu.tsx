import { BroomIcon } from "@solar-icons/solid/bold/broom";
import type { DropdownMenuEntry } from "../DropdownMenu/DropdownMenu";
import {
	EntryContextMenu,
	MarkAllReadIcon,
	sectionEntries,
	type TargetContextMenuProps,
} from "./menu-entries";

export type InboxMenuActions = {
	count?: number;
	unread?: number;
	onClearInbox?: () => void;
	onMarkAllRead?: () => void;
};

export const inboxMenuEntries = (
	actions: InboxMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			items: [
				actions.onClearInbox && {
					label: "Clear Inbox",
					get icon() {
						return <BroomIcon />;
					},
					disabled: (actions.count ?? 0) === 0,
					onSelect: actions.onClearInbox,
				},
				actions.onMarkAllRead && {
					label: "Mark everything as read",
					get icon() {
						return <MarkAllReadIcon />;
					},
					disabled: (actions.unread ?? 0) === 0,
					onSelect: actions.onMarkAllRead,
				},
			],
		},
	]);

export type InboxContextMenuProps = InboxMenuActions & TargetContextMenuProps;

export const InboxContextMenu = (props: InboxContextMenuProps) => (
	<EntryContextMenu
		label="Inbox options"
		entries={() => inboxMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);
