import { type ParentComponent, type Setter, Show } from "solid-js";
import createMediaQuery from "@/utils/create-media-query";
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
import { DialogDescriptionContent, DialogTitleContent } from "./shared";
import { DialogCancelButton, DialogConfirmButton, DialogTip } from "../shared";
import { deleteMessage } from "../util";

/**
 * The message deletion drawer used as a warning when a message is about to be deleted.
 */
export const Desktop: ParentComponent<{
	message: DBMessageData | PendingMessageData;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	open: boolean;
	setOpen: Setter<boolean>;
}> = (props) => {
	return (
		<Dialog open={props.open}>
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
					<MockMessage message={props.message as DBMessageData} />
					<DialogTip />
					<DialogFooter>
						<DialogCancelButton setOpen={props.setOpen} />
						<DialogConfirmButton
							onClick={() => {
								deleteMessage(
									props.message as IndexedMessageData,
									props.addDeletedMessage,
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
