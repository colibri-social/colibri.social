import { createMemo, For, type ParentComponent, Show } from "solid-js";
import { toast } from "somoto";
import ArrowBendUpLeftIcon from "~icons/ph/arrow-bend-up-left";
import CopyIcon from "~icons/ph/copy";
import HeartIcon from "~icons/ph/heart";
import InfoIcon from "~icons/ph/info";
import LinkBreakIcon from "~icons/ph/link-break";
import PencilIcon from "~icons/ph/pencil";
import ProhibitIcon from "~icons/ph/prohibit";
import SmileyIcon from "~icons/ph/smiley";
import StarIcon from "~icons/ph/star";
import StarFillIcon from "~icons/ph/star-fill";
import TrashIcon from "~icons/ph/trash";
import { usePermissions } from "../../../../../contexts/Community";
import { useGifFavorites } from "../../../../../contexts/GifFavorites";
import { useMessageContext } from "../../../../../contexts/Message";
import { useUserContext } from "../../../../../contexts/User";
import { useUserPreferences } from "../../../../../contexts/UserPreferences";
import { twemojiImageSrc } from "../../../../../utils/emoji";
import { topEmoji } from "../../../../../utils/emoji-usage";
import { useIsTouch } from "../../../../../utils/touch";
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
import {
	LinkContextMenuItems,
	LinkDrawerMenuItems,
} from "../../../common/LinkMenuItems";
import { copyMessageToClipboard } from "../../../common/text-editor/clipboard-facets";
import { DebugInfo } from "../DebugInfo";
import { gifItemFromUrl, gifLinkFromFacets } from "../Embed";
import { EmbedsDrawer } from "../EmbedsDrawer";

/**
 * Message context menu. On desktop it's a right-click Kobalte menu; on mobile a
 * long-press (wired in Message.tsx) opens the same actions as a bottom drawer.
 */
export const MessageContextMenu: ParentComponent<{
	classList?: Record<string, boolean>;
}> = (props) => {
	const user = useUserContext();
	const {
		message,
		isPending,
		messageEditable,
		canReply,
		enableReplyMode,
		enableEditMode,
		handlePotentialDeletion,
		setDebugModalOpen,
		blockModalOpen,
		deletionModalOpen,
		handlePotentialBlock,
		contextMenuOpen,
		setContextMenuOpen,
		reactionsViewerOpen,
		openReactionsViewer,
		emojiPopoverOpen,
		setEmojiPopoverOpen,
		addReactionOptimistic,
		linkTarget,
		openEmbedsModal,
		removableEmbedUris,
		canModerateEmbeds,
	} = useMessageContext();

	const { canHideMessage } = usePermissions();
	const { isFavorited, toggleFavorite } = useGifFavorites();
	const { emojiUsage } = useUserPreferences();
	const isTouch = useIsTouch();
	const ownsMessage = () => user.did === message.author.did;
	const quickReactions = createMemo(() => topEmoji(emojiUsage(), 4));

	const canManageEmbeds = () =>
		!isPending() &&
		removableEmbedUris().length > 0 &&
		(ownsMessage() || canModerateEmbeds());

	const isDisabled = () =>
		isPending() ||
		blockModalOpen() ||
		deletionModalOpen() ||
		reactionsViewerOpen() ||
		!!document.querySelector("#lightbox");

	const close = () => setContextMenuOpen(false);

	const copyText = () => {
		void copyMessageToClipboard(message.text, message.facets ?? []);
		toast.success("Message copied");
	};

	const gif = () => {
		const uri = gifLinkFromFacets(message.facets);
		return uri ? gifItemFromUrl(uri) : undefined;
	};

	return (
		<>
			<Show
				when={isTouch()}
				fallback={
					<ContextMenu onOpenChange={setContextMenuOpen}>
						<ContextMenuTrigger
							classList={props.classList}
							disabled={isDisabled()}
						>
							{props.children}
						</ContextMenuTrigger>
						<ContextMenuPortal>
							<ContextMenuContent>
								<Show when={linkTarget()}>
									<LinkContextMenuItems target={linkTarget} />
									<ContextMenuSeparator />
								</Show>
								<Show when={messageEditable()}>
									<ContextMenuItem onClick={enableEditMode}>
										<PencilIcon />
										<span>Edit Message</span>
									</ContextMenuItem>
								</Show>
								<Show when={canReply()}>
									<ContextMenuItem onClick={enableReplyMode}>
										<ArrowBendUpLeftIcon />
										<span>Reply</span>
									</ContextMenuItem>
									<ContextMenuSeparator />
								</Show>
								<Show when={message.text.length > 0}>
									<ContextMenuItem onClick={copyText}>
										<CopyIcon />
										<span>Copy Text</span>
									</ContextMenuItem>
								</Show>
								<Show when={gif()}>
									{(item) => (
										<ContextMenuItem
											onClick={() => void toggleFavorite(item())}
										>
											<Show when={isFavorited(item())} fallback={<StarIcon />}>
												<StarFillIcon class="text-yellow-400" />
											</Show>
											<span>
												{isFavorited(item()) ? "Remove saved GIF" : "Save GIF"}
											</span>
										</ContextMenuItem>
									)}
								</Show>
								<Show when={canManageEmbeds()}>
									<ContextMenuItem onClick={() => openEmbedsModal()}>
										<LinkBreakIcon />
										<span>Link Previews</span>
									</ContextMenuItem>
								</Show>
								<Show when={message.reactions.length > 0}>
									<ContextMenuItem onClick={() => openReactionsViewer()}>
										<HeartIcon />
										<span>View Reactions</span>
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
										<ProhibitIcon class="text-destructive" />
										<span class="text-destructive">Block Message</span>
									</ContextMenuItem>
								</Show>
							</ContextMenuContent>
						</ContextMenuPortal>
					</ContextMenu>
				}
			>
				<div classList={props.classList}>{props.children}</div>
				<MenuDrawer open={contextMenuOpen()} onOpenChange={setContextMenuOpen}>
					<Show when={!isPending()}>
						<div class="flex flex-row items-center justify-between gap-1 px-2 pb-2 mb-1 border-b border-border">
							<For each={quickReactions()}>
								{(emoji) => (
									<button
										type="button"
										class="flex-1 h-12 flex items-center justify-center rounded-md hover:bg-muted active:bg-muted"
										onClick={() => {
											close();
											void addReactionOptimistic(emoji);
										}}
									>
										<img
											src={twemojiImageSrc(emoji)}
											alt={emoji}
											class="size-5 object-contain"
											loading="lazy"
											decoding="async"
										/>
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
					<Show when={linkTarget()}>
						<LinkDrawerMenuItems target={linkTarget} onSelect={close} />
						<Separator class="my-1" />
					</Show>
					<Show when={messageEditable()}>
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
					<Show when={canReply()}>
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
					</Show>
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
					<Show when={gif()}>
						{(item) => (
							<MenuDrawerItem
								onClick={() => {
									close();
									void toggleFavorite(item());
								}}
							>
								<Show when={isFavorited(item())} fallback={<StarIcon />}>
									<StarFillIcon class="text-yellow-400" />
								</Show>
								<span>
									{isFavorited(item()) ? "Remove saved GIF" : "Save GIF"}
								</span>
							</MenuDrawerItem>
						)}
					</Show>
					<Show when={canManageEmbeds()}>
						<MenuDrawerItem
							onClick={() => handoffDrawer(close, () => openEmbedsModal())}
						>
							<LinkBreakIcon />
							<span>Link Previews</span>
						</MenuDrawerItem>
					</Show>
					<Show when={message.reactions.length > 0}>
						<MenuDrawerItem
							onClick={() => handoffDrawer(close, () => openReactionsViewer())}
						>
							<HeartIcon />
							<span>View Reactions</span>
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
							<ProhibitIcon />
							<span>Block Message</span>
						</MenuDrawerItem>
					</Show>
				</MenuDrawer>
				<EmojiPopover
					asSheet
					emojiPopoverOpen={emojiPopoverOpen}
					setEmojiPopoverOpen={setEmojiPopoverOpen}
					addReactionOptimistic={(emoji) => void addReactionOptimistic(emoji)}
				/>
			</Show>
			<Show when={!("hash" in message)}>
				<DebugInfo />
				<EmbedsDrawer />
			</Show>
		</>
	);
};
