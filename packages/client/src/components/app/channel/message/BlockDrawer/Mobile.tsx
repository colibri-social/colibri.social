import type { Component } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import { BottomSheet } from "../../../../ui/MenuDrawer";
import { MessagePreview } from "../MessagePreview";
import { DialogCancelButton } from "../shared";
import { BlockDialogConfirmButton, BlockDialogTitleContent } from "./shared";

/**
 * The mobile version of the message block drawer used as a warning when a message is about to be blocked.
 */
export const Mobile: Component = () => {
	const { message, blockModalOpen, setBlockModalOpen, confirmBlock } =
		useMessageContext();

	return (
		<BottomSheet open={blockModalOpen()} onOpenChange={setBlockModalOpen}>
			<div class="flex flex-col gap-1.5 p-4">
				<h2 class="m-0 text-foreground font-semibold">
					<BlockDialogTitleContent />
				</h2>
				<p class="m-0 text-sm text-muted-foreground">
					<BlockDialogTitleContent />
				</p>
			</div>
			<MessagePreview data={message} />
			<div class="mt-auto flex flex-col gap-2 p-4 pb-[calc(1rem+var(--safe-area-bottom))]">
				<DialogCancelButton setOpen={setBlockModalOpen} />
				<BlockDialogConfirmButton onClick={confirmBlock} />
			</div>
		</BottomSheet>
	);
};
