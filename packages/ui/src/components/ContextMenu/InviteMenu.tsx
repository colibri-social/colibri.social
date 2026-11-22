import { LinkIcon } from "@solar-icons/solid/bold/link";
import { ShareIcon } from "@solar-icons/solid/bold/share";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import type { DropdownMenuEntry } from "../DropdownMenu/DropdownMenu";
import {
	EntryContextMenu,
	sectionEntries,
	type TargetContextMenuProps,
} from "./menu-entries";

export type InviteMenuActions = {
	onCopyLink?: () => void;
	onShare?: () => void;
	onDelete?: () => void;
};

export const inviteMenuEntries = (
	actions: InviteMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		{
			items: [
				actions.onCopyLink && {
					label: "Copy invite link",
					get icon() {
						return <LinkIcon />;
					},
					onSelect: actions.onCopyLink,
				},
				actions.onShare && {
					label: "Share invite",
					get icon() {
						return <ShareIcon />;
					},
					onSelect: actions.onShare,
				},
			],
		},
		{
			items: [
				actions.onDelete && {
					label: "Delete invite link",
					get icon() {
						return <TrashBinTrashIcon />;
					},
					tone: "destructive",
					onSelect: actions.onDelete,
				},
			],
		},
	]);

export type InviteContextMenuProps = InviteMenuActions &
	TargetContextMenuProps & { code: string };

export const InviteContextMenu = (props: InviteContextMenuProps) => (
	<EntryContextMenu
		label={`Invite ${props.code} options`}
		entries={() => inviteMenuEntries(props)}
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
	>
		{props.children}
	</EntryContextMenu>
);
