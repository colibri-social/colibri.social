import type { ParentComponent, Setter } from "solid-js";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../../contexts/GlobalContext";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerLabel,
	DrawerPortal,
	DrawerTrigger,
} from "../../../shadcn-solid/Drawer";
import { MockMessage } from "../MockMessage";
import { DialogCancelButton } from "../shared";
import { blockMessage } from "../util";
import { BlockDialogConfirmButton, BlockDialogTitleContent } from "./shared";

/**
 * The mobile version of the message deletion drawer used as a warning when a message is about to be deleted.
 */
export const Mobile: ParentComponent<{
	open: boolean;
	setOpen: Setter<boolean>;
	message: DBMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	community: string;
}> = (props) => {
	return (
		<Drawer breakPoints={[0.75]} open={props.open}>
			<DrawerTrigger>{props.children}</DrawerTrigger>
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
					<MockMessage message={props.message as DBMessageData} />
					<DrawerFooter>
						<DialogCancelButton setOpen={props.setOpen} />
						<BlockDialogConfirmButton
							onClick={() => {
								blockMessage(
									props.message as IndexedMessageData,
									props.addDeletedMessage,
									props.community,
									props.setOpen,
								);
							}}
						/>
					</DrawerFooter>
				</DrawerContent>
			</DrawerPortal>
		</Drawer>
	);
};
