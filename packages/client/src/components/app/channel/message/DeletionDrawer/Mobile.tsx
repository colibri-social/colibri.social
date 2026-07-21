import type { Component } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import { BottomSheet } from "../../../../ui/MenuDrawer";
import { MessagePreview } from "../MessagePreview";
import { DialogConfirmButton, MobileCancelButton } from "../shared";
import {
	DialogDescriptionContent,
	DialogTitleContent,
	useConfirmOnEnter,
} from "./shared";

/**
 * The mobile version of the message deletion drawer used as a warning when a message is about to be deleted.
 */
export const Mobile: Component = () => {
	const { message, deletionModalOpen, setDeletionModalOpen, confirmDelete } =
		useMessageContext();

	useConfirmOnEnter(deletionModalOpen, confirmDelete);

	return (
		<BottomSheet open={deletionModalOpen()} onOpenChange={setDeletionModalOpen}>
			<div class="flex flex-col gap-1.5 p-4">
				<h2 class="m-0 text-foreground font-semibold">
					<DialogTitleContent />
				</h2>
				<p class="m-0 text-sm text-muted-foreground">
					<DialogDescriptionContent />
				</p>
			</div>
			<MessagePreview data={message} />
			<div class="mt-auto flex flex-col gap-2 p-4 pb-[calc(1rem+var(--safe-area-bottom))]">
				<MobileCancelButton setOpen={setDeletionModalOpen} />
				<DialogConfirmButton onClick={confirmDelete} />
			</div>
		</BottomSheet>
	);
};
