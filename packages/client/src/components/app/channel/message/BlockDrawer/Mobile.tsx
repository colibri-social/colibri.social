import type { Component } from "solid-js";
import { useMessageContext } from "../../../../../contexts/Message";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
} from "../../../../ui/Drawer";
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
		<Drawer
			breakPoints={[0.75]}
			open={blockModalOpen()}
			onOpenChange={setBlockModalOpen}
		>
			<DrawerPortal>
				<DrawerContent>
					<DrawerHeader>
						<DrawerLabel class="m-0">
							<BlockDialogTitleContent />
						</DrawerLabel>
						<DrawerDescription class="m-0">
							<BlockDialogTitleContent />
						</DrawerDescription>
					</DrawerHeader>
					<MessagePreview data={message} />
					<DrawerFooter>
						<DialogCancelButton setOpen={setBlockModalOpen} />
						<BlockDialogConfirmButton onClick={confirmBlock} />
					</DrawerFooter>
				</DrawerContent>
			</DrawerPortal>
		</Drawer>
	);
};
