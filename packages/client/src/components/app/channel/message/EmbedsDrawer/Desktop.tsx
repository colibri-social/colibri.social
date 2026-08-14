import type { Component } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../../../ui/Dialog";
import { DialogTip } from "../shared";
import {
	EmbedsDialogBody,
	EmbedsDialogCancelButton,
	EmbedsDialogDescriptionContent,
	EmbedsDialogSaveButton,
	EmbedsDialogTitleContent,
} from "./shared";

export const Desktop: Component = () => {
	const { embedsModalOpen, closeEmbedsModal } = useMessageContext();

	return (
		<Dialog
			open={embedsModalOpen()}
			onOpenChange={(open) => {
				if (!open) closeEmbedsModal();
			}}
		>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle class="m-0">
							<EmbedsDialogTitleContent />
						</DialogTitle>
						<DialogDescription class="m-0">
							<EmbedsDialogDescriptionContent />
						</DialogDescription>
					</DialogHeader>
					<EmbedsDialogBody />
					<DialogTip />
					<DialogFooter>
						<EmbedsDialogCancelButton />
						<EmbedsDialogSaveButton />
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
