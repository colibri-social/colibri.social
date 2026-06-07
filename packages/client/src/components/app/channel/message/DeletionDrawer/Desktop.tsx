import type { ParentComponent } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../../../ui/Dialog";
import { MessagePreview } from "../MessagePreview";
import { DialogCancelButton, DialogConfirmButton, DialogTip } from "../shared";
import { DialogDescriptionContent, DialogTitleContent } from "./shared";

/**
 * The message deletion drawer used as a warning when a message is about to be deleted.
 */
export const Desktop: ParentComponent = (props) => {
	const { message, deletionModalOpen, setDeletionModalOpen, confirmDelete } =
		useMessageContext();

	return (
		<Dialog open={deletionModalOpen()} onOpenChange={setDeletionModalOpen}>
			<DialogTrigger class="w-full">{props.children}</DialogTrigger>
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
