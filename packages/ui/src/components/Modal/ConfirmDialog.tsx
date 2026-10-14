import { createEffect, createMemo, createSignal, type JSX, on } from "solid-js";
import { Button } from "../Button/Button";
import { Modal, ModalContent } from "./Modal";

export type ConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: JSX.Element;
	description?: JSX.Element;
	confirmLabel: string;
	cancelLabel?: string;
	tone?: "default" | "destructive";
	onConfirm: () => Promise<void> | void;
};

export const ConfirmDialog = (props: ConfirmDialogProps) => {
	const [busy, setBusy] = createSignal(false);

	const open = createMemo(() => props.open);
	createEffect(
		on(open, (isOpen) => {
			if (isOpen) setBusy(false);
		}),
	);

	const handleOpenChange = (next: boolean) => {
		if (!next && busy()) return;
		props.onOpenChange(next);
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
				title={props.title}
				description={props.description}
				footer={
					<>
						<Button
							variant="secondary"
							disabled={busy()}
							onClick={() => props.onOpenChange(false)}
						>
							{props.cancelLabel ?? "Cancel"}
						</Button>
						<Button
							variant={props.tone === "destructive" ? "destructive" : "primary"}
							loading={busy()}
							onClick={confirm}
						>
							{props.confirmLabel}
						</Button>
					</>
				}
			/>
		</Modal>
	);
};
