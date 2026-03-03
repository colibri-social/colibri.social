import { type ParentComponent, type Setter, Show } from "solid-js";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../contexts/GlobalContext";
import { Pencil } from "../../icons/Pencil";
import { Reply } from "../../icons/Reply";
import { Trash } from "../../icons/Trash";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../../shadcn-solid/ContextMenu";
import { MessageDeletionDrawer } from "./MessageDeletionDrawer";
import { MessageDebugInfo } from "./MessageDebugInfo";
import { Info } from "../../icons/Info";

/**
 * A component handling the right click context menu for messages.
 */
export const MessageContextMenu: ParentComponent<{
	data: IndexedMessageData | PendingMessageData;
	disabled: boolean;
	enableEditMode: () => void;
	enableReplyMode: () => void;
	handlePotentialDeletion: (e: MouseEvent) => void;
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"];
	setEmojiPopoverOpen: (state: boolean) => void;
	messageEditable: () => boolean;
	deletionModalOpen: boolean;
	setDeletionModalOpen: Setter<boolean>;
	debugModalOpen: boolean;
	setDebugModalOpen: Setter<boolean>;
}> = (props) => {
	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger
					disabled={
						props.disabled || props.debugModalOpen || props.deletionModalOpen
					}
				>
					{props.children}
				</ContextMenuTrigger>
				<ContextMenuPortal>
					<ContextMenuContent>
						<ContextMenuItem onClick={props.enableReplyMode}>
							<Reply />
							<span>Reply</span>
						</ContextMenuItem>
						<Show when={!("hash" in props.data)}>
							<ContextMenuItem onClick={() => props.setDebugModalOpen(true)}>
								<Info />
								<span>Show Debug Information</span>
							</ContextMenuItem>
						</Show>
						<Show when={props.messageEditable()}>
							<ContextMenuItem onClick={props.enableEditMode}>
								<Pencil />
								<span>Edit</span>
							</ContextMenuItem>
							<MessageDeletionDrawer
								message={props.data}
								addDeletedMessage={props.addDeletedMessage}
								open={props.deletionModalOpen}
								setOpen={props.setDeletionModalOpen}
							>
								<ContextMenuItem
									class="text-destructive"
									onClick={(e) => {
										props.handlePotentialDeletion(e);
									}}
								>
									<Trash />
									<span>Delete</span>
								</ContextMenuItem>
							</MessageDeletionDrawer>
						</Show>
					</ContextMenuContent>
				</ContextMenuPortal>
			</ContextMenu>
			<Show when={!("hash" in props.data)}>
				<MessageDebugInfo
					message={props.data as DBMessageData}
					open={props.debugModalOpen}
					setOpen={props.setDebugModalOpen}
				/>
			</Show>
		</>
	);
};
