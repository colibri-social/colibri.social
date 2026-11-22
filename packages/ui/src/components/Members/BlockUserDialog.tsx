import { ConfirmDialog } from "../Modal/ConfirmDialog";

export type BlockUserDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	onConfirm: () => Promise<void> | void;
};

export const BLOCK_USER_COPY = {
	title: (name: string) => `Block ${name}?`,
	description:
		"You won't get notifications from them, and their messages stay collapsed until you choose to see them. They won't be told. You can unblock them in Settings at any time.",
	confirm: "Block",
} as const;

export const BlockUserDialog = (props: BlockUserDialogProps) => {
	return (
		<ConfirmDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			title={BLOCK_USER_COPY.title(props.name)}
			description={BLOCK_USER_COPY.description}
			confirmLabel={BLOCK_USER_COPY.confirm}
			tone="destructive"
			onConfirm={props.onConfirm}
		/>
	);
};
