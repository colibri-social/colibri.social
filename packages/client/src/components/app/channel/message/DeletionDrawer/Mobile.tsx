import type { ParentComponent } from "solid-js";
import { DialogDescriptionContent, DialogTitleContent } from "./shared";
import { MessagePreview } from "../MessagePreview";
import { useMessageContext } from "../../../../../contexts/Message";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
	DrawerTrigger,
} from "../../../../ui/Drawer";
import { DialogCancelButton, DialogConfirmButton } from "../shared";

/**
 * The mobile version of the message deletion drawer used as a warning when a message is about to be deleted.
 */
export const Mobile: ParentComponent = (props) => {
	const { message, deletionModalOpen, setDeletionModalOpen, confirmDelete } =
		useMessageContext();

	return (
		<Drawer
			breakPoints={[0.75]}
			open={deletionModalOpen()}
			onOpenChange={setDeletionModalOpen}
		>
			<DrawerTrigger>{props.children}</DrawerTrigger>
			<DrawerPortal>
				<DrawerContent>
					<DrawerHeader>
						<DrawerLabel class="m-0">
							<DialogTitleContent />
						</DrawerLabel>
						<DrawerDescription class="m-0">
							<DialogDescriptionContent />
						</DrawerDescription>
					</DrawerHeader>
					<MessagePreview data={message} />
					<DrawerFooter>
						<DialogCancelButton setOpen={setDeletionModalOpen} />
						<DialogConfirmButton onClick={confirmDelete} />
					</DrawerFooter>
				</DrawerContent>
			</DrawerPortal>
		</Drawer>
	);
};
