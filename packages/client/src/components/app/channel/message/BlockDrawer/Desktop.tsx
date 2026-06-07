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
import { DialogCancelButton, DialogTip } from "../shared";
import {
	BlockDialogConfirmButton,
	BlockDialogDescriptionContent,
	BlockDialogTitleContent,
} from "./shared";

/**
 * The message block drawer used as a warning when a message is about to be blocked by an admin.
 */
export const Desktop: ParentComponent = (props) => {
	const { message, blockModalOpen, setBlockModalOpen, confirmBlock } =
		useMessageContext();

	return (
		<Dialog open={blockModalOpen()} onOpenChange={setBlockModalOpen}>
			<DialogTrigger class="w-full">{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle class="m-0">
							<BlockDialogTitleContent />
						</DialogTitle>
						<DialogDescription class="m-0">
							<BlockDialogDescriptionContent />
						</DialogDescription>
					</DialogHeader>
					<MessagePreview data={message} />
					<DialogTip />
					<DialogFooter>
						<DialogCancelButton setOpen={setBlockModalOpen} />
						<BlockDialogConfirmButton onClick={confirmBlock} />
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
