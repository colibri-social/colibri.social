import { type ParentComponent, type Setter } from "solid-js";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../../contexts/GlobalContext";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../../shadcn-solid/Dialog";
import { MockMessage } from "../MockMessage";
import { blockMessage } from "../util";
import {
	BlockDialogConfirmButton,
	BlockDialogDescriptionContent,
	BlockDialogTitleContent,
} from "./shared";
import { DialogCancelButton, DialogTip } from "../shared";

/**
 * The message black drawer used as a warning when a message is about to be blocked by an admin.
 */
export const Desktop: ParentComponent<{
	message: DBMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	open: boolean;
	setOpen: Setter<boolean>;
	community: string;
}> = (props) => {
	return (
		<Dialog open={props.open}>
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
					<MockMessage message={props.message as DBMessageData} />
					<DialogTip />
					<DialogFooter>
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
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
