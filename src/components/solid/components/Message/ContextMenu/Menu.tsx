import { type ParentComponent, type Setter, Show } from "solid-js";
import { Icon } from "@/components/solid/icons/Icon";
import type { DBMessageData, IndexedMessageData } from "@/utils/sdk";
import type {
	GlobalContextUtility,
	PendingMessageData,
} from "../../../contexts/GlobalContext";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../../../shadcn-solid/ContextMenu";
import { DeletionDrawer } from "../DeletionDrawer";
import { DebugInfo } from "../DebugInfo";

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
	const isDisabled = () =>
		props.disabled ||
		props.debugModalOpen ||
		props.deletionModalOpen ||
		!!document.querySelector("#lightbox");

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger disabled={isDisabled()}>
					{props.children}
				</ContextMenuTrigger>
				<ContextMenuPortal>
					<ContextMenuContent>
						<ContextMenuItem onClick={props.enableReplyMode}>
							<Icon variant="regular" name="arrow-bend-up-left-icon" />
							<span>Reply</span>
						</ContextMenuItem>
						<Show when={!("hash" in props.data)}>
							<ContextMenuItem onClick={() => props.setDebugModalOpen(true)}>
								<Icon variant="regular" name="info-icon" />
								<span>Show Debug Information</span>
							</ContextMenuItem>
						</Show>
						<Show when={props.messageEditable()}>
							<ContextMenuItem onClick={props.enableEditMode}>
								<Icon variant="regular" name="pencil-icon" />
								<span>Edit</span>
							</ContextMenuItem>
							<DeletionDrawer
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
									<Icon variant="regular" name="trash-icon" />
									<span>Delete</span>
								</ContextMenuItem>
							</DeletionDrawer>
						</Show>
					</ContextMenuContent>
				</ContextMenuPortal>
			</ContextMenu>
			<Show when={!("hash" in props.data)}>
				<DebugInfo
					message={props.data as DBMessageData}
					open={props.debugModalOpen}
					setOpen={props.setDebugModalOpen}
				/>
			</Show>
		</>
	);
};
