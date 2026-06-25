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
import { usePermissions } from "../../../../../contexts/Community";
import { useUserContext } from "../../../../../contexts/User";

/**
 * A component handling the right click context menu for messages.
 */
export const MessageContextMenu: ParentComponent = (props) => {
	const user = useUserContext();
	const {
		message,
		isPending,
		messageEditable,
		enableReplyMode,
		enableEditMode,
		handlePotentialDeletion,
		setDebugModalOpen,
		blockModalOpen,
		deletionModalOpen,
		handlePotentialBlock,
	} = useMessageContext();

	const { canHideMessage } = usePermissions();
	const ownsMessage = () => user.did === message.author.did;

	const isDisabled = () =>
		isPending() ||
		blockModalOpen() ||
		deletionModalOpen() ||
		!!document.querySelector("#lightbox");

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
								<span>Edit Message</span>
							</ContextMenuItem>
							<ContextMenuItem
								onClick={(e) => handlePotentialDeletion(e as MouseEvent)}
							>
								<TrashIcon class="text-destructive" />
								<span class="text-destructive">Delete Message</span>
							</ContextMenuItem>
						</Show>
						<Show when={!ownsMessage() && canHideMessage(user.did)}>
							<ContextMenuItem
								onClick={(e) => handlePotentialBlock(e as MouseEvent)}
							>
								<TrashIcon class="text-destructive" />
								<span class="text-destructive">Block Message</span>
							</ContextMenuItem>
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
