import { createEffect, createMemo, createSignal, on } from "solid-js";
import { Button } from "../Button/Button";
import { Modal, ModalContent } from "../Modal/Modal";

export type MemberAction = "kick" | "ban";

export type MemberActionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: MemberAction;
	name: string;
	requiresApproval?: boolean;
	onConfirm: () => void | Promise<void>;
};

export const memberActionTitle = (kind: MemberAction, name: string) =>
	kind === "kick"
		? `Kick ${name} from this Space?`
		: `Ban ${name} from this Space?`;

export const memberActionDescription = (
	kind: MemberAction,
	requiresApproval?: boolean,
) => {
	if (kind === "ban") {
		return "They lose access to this Space, but their existing messages stay as they are. Revoke the ban to let them back in.";
	}
	return requiresApproval
		? "Their request to rejoin will need approval again."
		: "They can rejoin with an invite link at any time.";
};

export const MemberActionDialog = (props: MemberActionDialogProps) => {
	const [busy, setBusy] = createSignal(false);

	const open = createMemo(() => props.open);
	createEffect(
		on(open, (isOpen) => {
			if (isOpen) setBusy(false);
		}),
	);

	const handleOpenChange = (open: boolean) => {
		if (!open && busy()) return;
		props.onOpenChange(open);
	};

	const confirm = () => {
		setBusy(true);
		Promise.resolve()
			.then(() => props.onConfirm())
			.then(
				() => props.onOpenChange(false),
				() => undefined,
			)
			.finally(() => setBusy(false));
	};

	return (
		<Modal open={props.open} onOpenChange={handleOpenChange}>
			<ModalContent
				title={memberActionTitle(props.kind, props.name)}
				description={memberActionDescription(
					props.kind,
					props.requiresApproval,
				)}
				footer={
					<>
						<Button
							variant="secondary"
							disabled={busy()}
							onClick={() => props.onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button variant="destructive" loading={busy()} onClick={confirm}>
							{props.kind === "kick" ? "Kick" : "Ban"}
						</Button>
					</>
				}
			/>
		</Modal>
	);
};
