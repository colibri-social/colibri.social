import { facetsToSource } from "@colibri-social/lib";
import { For, type ParentComponent, Show } from "solid-js";
import { toast } from "somoto";
import ArrowBendUpLeftIcon from "~icons/ph/arrow-bend-up-left";
import CopyIcon from "~icons/ph/copy";
import InfoIcon from "~icons/ph/info";
import PencilIcon from "~icons/ph/pencil";
import SmileyIcon from "~icons/ph/smiley";
import TrashIcon from "~icons/ph/trash";
import { usePermissions } from "../../../../../contexts/Community";
import { useMessageContext } from "../../../../../contexts/Message";
import { useUserContext } from "../../../../../contexts/User";
import { useIsMobile } from "../../../../../utils/mobile-pane";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "../../../../ui/ContextMenu";
import {
	handoffDrawer,
	MenuDrawer,
	MenuDrawerItem,
} from "../../../../ui/MenuDrawer";
import { Separator } from "../../../../ui/Separator";
import { EmojiPopover } from "../../../common/EmojiPopover";
import { DebugInfo } from "../DebugInfo";

/**
 * Message context menu. On desktop it's a right-click Kobalte menu; on mobile a
 * long-press (wired in Message.tsx) opens the same actions as a bottom drawer.
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
		contextMenuOpen,
		setContextMenuOpen,
		emojiPopoverOpen,
		setEmojiPopoverOpen,
		addReactionOptimistic,
	} = useMessageContext();

	const { canHideMessage } = usePermissions();
	const isMobile = useIsMobile();
	const ownsMessage = () => user.did === message.author.did;
	const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮"];

	const isDisabled = () =>
		isPending() ||
		blockModalOpen() ||
		deletionModalOpen() ||
		!!document.querySelector("#lightbox");

	const close = () => setContextMenuOpen(false);

	const copyText = () => {
		const { source } = facetsToSource(message.text, message.facets ?? []);
		void navigator.clipboard.writeText(source);
		toast.success("Message copied");
	};

	return (
		<>
			<Show
				when={isMobile()}
				fallback={
					<ContextMenu>
						<ContextMenuTrigger disabled={isDisabled()}>
							{props.children}
						</ContextMenuTrigger>
						<ContextMenuPortal>
							<ContextMenuContent>
								<Show when={messageEditable()}>
									<Show when={message.text.length > 0}>
										<ContextMenuItem onClick={enableEditMode}>
											<PencilIcon />
											<span>Edit Message</span>
										</ContextMenuItem>
									</Show>
								</Show>
								<ContextMenuItem onClick={enableReplyMode}>
									<ArrowBendUpLeftIcon />
									<span>Reply</span>
								</ContextMenuItem>
								<ContextMenuSeparator />
								<Show when={message.text.length > 0}>
									<ContextMenuItem onClick={copyText}>
										<CopyIcon />
										<span>Copy Text</span>
									</ContextMenuItem>
								</Show>
								<Show when={!("hash" in message)}>
									<ContextMenuItem onClick={() => setDebugModalOpen(true)}>
										<InfoIcon />
										<span>Show Debug Information</span>
									</ContextMenuItem>
								</Show>
								<Show when={messageEditable()}>
									<ContextMenuSeparator />
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
				}
			>
				{props.children}
				<MenuDrawer open={contextMenuOpen()} onOpenChange={setContextMenuOpen}>
					<Show when={!isPending()}>
						<div class="flex flex-row items-center justify-between gap-1 px-2 pb-2 mb-1 border-b border-border">
							<For each={QUICK_REACTIONS}>
								{(emoji) => (
									<button
										type="button"
										class="flex-1 h-12 flex items-center justify-center rounded-md text-2xl hover:bg-muted active:bg-muted"
										onClick={() => {
											close();
											void addReactionOptimistic(emoji);
										}}
									>
										{emoji}
									</button>
								)}
							</For>
							<button
								type="button"
								aria-label="More emojis"
								class="flex-1 h-12 flex items-center justify-center rounded-md hover:bg-muted active:bg-muted text-muted-foreground"
								onClick={() =>
									handoffDrawer(close, () => setEmojiPopoverOpen(true))
								}
							>
								<SmileyIcon width={24} height={24} />
							</button>
						</div>
					</Show>
					<Show when={messageEditable()}>
						<Show when={message.text.length > 0}>
							<MenuDrawerItem
								onClick={() => {
									close();
									enableEditMode();
								}}
							>
								<PencilIcon />
								<span>Edit Message</span>
							</MenuDrawerItem>
						</Show>
					</Show>
					<MenuDrawerItem
						onClick={() => {
							close();
							enableReplyMode();
						}}
					>
						<ArrowBendUpLeftIcon />
						<span>Reply</span>
					</MenuDrawerItem>
					<Separator class="my-1" />
					<Show when={message.text.length > 0}>
						<MenuDrawerItem
							onClick={() => {
								close();
								copyText();
							}}
						>
							<CopyIcon />
							<span>Copy Text</span>
						</MenuDrawerItem>
					</Show>
					<Show when={!("hash" in message)}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(close, () => setDebugModalOpen(true))
							}
						>
							<InfoIcon />
							<span>Show Debug Information</span>
						</MenuDrawerItem>
					</Show>
					<Show when={messageEditable()}>
						<Separator class="my-1" />
						<MenuDrawerItem
							destructive
							onClick={(e) =>
								handoffDrawer(close, () =>
									handlePotentialDeletion(e as MouseEvent),
								)
							}
						>
							<TrashIcon />
							<span>Delete Message</span>
						</MenuDrawerItem>
					</Show>
					<Show when={!ownsMessage() && canHideMessage(user.did)}>
						<MenuDrawerItem
							destructive
							onClick={(e) =>
								handoffDrawer(close, () =>
									handlePotentialBlock(e as MouseEvent),
								)
							}
						>
							<TrashIcon />
							<span>Block Message</span>
						</MenuDrawerItem>
					</Show>
				</MenuDrawer>
				<EmojiPopover
					emojiPopoverOpen={emojiPopoverOpen}
					setEmojiPopoverOpen={setEmojiPopoverOpen}
					addReactionOptimistic={(emoji) => void addReactionOptimistic(emoji)}
				/>
			</Show>
			<Show when={!("hash" in message)}>
				<DebugInfo />
			</Show>
		</>
	);
};
