import { type ParentComponent, Show } from "solid-js";
import ArrowBendUpLeftIcon from "~icons/ph/arrow-bend-up-left";
import InfoIcon from "~icons/ph/info";
import PencilIcon from "~icons/ph/pencil";
import TrashIcon from "~icons/ph/trash";
import { useMessageContext } from "../../../../../contexts/Message";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuTrigger,
} from "../../../../ui/ContextMenu";
import { DebugInfo } from "../DebugInfo";
import { DeletionDrawer } from "../DeletionDrawer";

/**
 * A component handling the right click context menu for messages.
 */
export const MessageContextMenu: ParentComponent = (props) => {
	const {
		message,
		isPending,
		messageEditable,
		enableReplyMode,
		enableEditMode,
		handlePotentialDeletion,
		setDebugModalOpen,
	} = useMessageContext();

	const isDisabled = () => isPending() || !!document.querySelector("#lightbox");

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger disabled={isDisabled()}>
					{props.children}
				</ContextMenuTrigger>
				<ContextMenuPortal>
					<ContextMenuContent>
						<ContextMenuItem onClick={enableReplyMode}>
							<ArrowBendUpLeftIcon />
							<span>Reply</span>
						</ContextMenuItem>
						<Show when={!("hash" in message)}>
							<ContextMenuItem onClick={() => setDebugModalOpen(true)}>
								<InfoIcon />
								<span>Show Debug Information</span>
							</ContextMenuItem>
						</Show>
						<Show when={messageEditable()}>
							<ContextMenuItem onClick={enableEditMode}>
								<PencilIcon />
								<span>Edit</span>
							</ContextMenuItem>
							<DeletionDrawer>
								<ContextMenuItem
									class="text-destructive"
									onClick={(e) => handlePotentialDeletion(e as MouseEvent)}
								>
									<TrashIcon />
									<span>Delete</span>
								</ContextMenuItem>
							</DeletionDrawer>
						</Show>
					</ContextMenuContent>
				</ContextMenuPortal>
			</ContextMenu>
			<Show when={!("hash" in message)}>
				<DebugInfo />
			</Show>
		</>
	);
};
