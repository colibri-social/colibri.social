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
import { MessagePreview } from "../MessagePreview";
import { DialogCancelButton, DialogConfirmButton, DialogTip } from "../shared";
import {
	DialogDescriptionContent,
	DialogTitleContent,
	useConfirmOnEnter,
} from "./shared";

/**
 * The message deletion drawer used as a warning when a message is about to be deleted.
 */
export const Desktop: Component = () => {
	const { message, deletionModalOpen, setDeletionModalOpen, confirmDelete } =
		useMessageContext();

	useConfirmOnEnter(deletionModalOpen, confirmDelete);

	return (
		<Dialog open={deletionModalOpen()} onOpenChange={setDeletionModalOpen}>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle class="m-0">
							<DialogTitleContent />
						</DialogTitle>
						<DialogDescription class="m-0">
							<DialogDescriptionContent />
						</DialogDescription>
					</DialogHeader>
					<MessagePreview data={message} />
					<DialogTip />
					<DialogFooter>
						<DialogCancelButton setOpen={setDeletionModalOpen} />
						<DialogConfirmButton onClick={confirmDelete} />
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
