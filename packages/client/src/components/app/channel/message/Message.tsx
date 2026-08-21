import type { ActorData, ColibriRichTextLink } from "@colibri-social/lib";
import {
	batch,
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import ArrowBendUpLeft from "~icons/ph/arrow-bend-up-left";
import PencilIcon from "~icons/ph/pencil";
import ProhibitIcon from "~icons/ph/prohibit";
import SmileyIcon from "~icons/ph/smiley";
import TrashIcon from "~icons/ph/trash";
import type { Message as MessageData } from "../../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useChannelContext } from "../../../../contexts/Channel";
import { useCommunityContext } from "../../../../contexts/Community";
import {
	MessageContextProvider,
	useMessageContext,
} from "../../../../contexts/Message";
import { useUserContext } from "../../../../contexts/User";
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import { createDoubleTap } from "../../../../utils/create-double-tap";
import { createLongPress } from "../../../../utils/create-long-press";
import { createSwipe } from "../../../../utils/create-swipe";
import { parseEmojiText, twemojiImageSrc } from "../../../../utils/emoji";
import { topEmoji } from "../../../../utils/emoji-usage";
import { resolveLinkTarget } from "../../../../utils/link-target";
import { useIsMobile } from "../../../../utils/mobile-pane";
import { useIsTouch } from "../../../../utils/touch";
import { SectionBoundary } from "../../../SectionBoundary";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
	type TooltipTriggerProps,
} from "../../../ui/Tooltip";
import { EmojiPopover } from "../../common/EmojiPopover";
import { RichTextRenderer } from "../../common/rich-text-renderer/RichTextRenderer";
import { MemberContextMenu } from "../../community/MemberContextMenu";
import User from "../../user";
import { MessageAttachments } from "./Attachments";
import { BlockDrawer } from "./BlockDrawer";
import { Action } from "./ContextMenu";
import { MessageContextMenu } from "./ContextMenu/Menu";
import { DeletionDrawer } from "./DeletionDrawer/index";
import {
	Embed,
	isBrokenMediaLink,
	isDirectMediaUrl,
	isRemovableEmbed,
} from "./Embed";
import { InlineEditor } from "./InlineEditor";
import { MessageTimestamp } from "./MessageTimestamp";
import { ReactionsViewer } from "./ReactionsViewer";
import { emojiShortcode, reactedByLabel, useReactorResolver } from "./reactors";

function reactTooltip(emoji: string): string {
	const shortcode = emojiShortcode(emoji);
	if (!shortcode) return "React";
	return `React with :${shortcode}:`;
}

/**
 * A rendered message component in a chat.
 */
export const Message: Component<{
	data: MessageData;
	isSubsequent: boolean;
	hasSubsequent: boolean;
	isLast: boolean;
	disabled?: boolean;
}> = (props) => {
	return (
		<MessageContextProvider data={props.data}>
			<MessageInner
				isSubsequent={props.isSubsequent}
				hasSubsequent={props.hasSubsequent}
				isLast={props.isLast}
				disabled={props.disabled}
			/>
		</MessageContextProvider>
	);
};

const MessageInner: Component<{
	isSubsequent: boolean;
	hasSubsequent: boolean;
	isLast: boolean;
	disabled?: boolean;
}> = (props) => {
	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();
	const isMobile = useIsMobile();
	const isTouch = useIsTouch();
	const { preferences, emojiUsage } = useUserPreferences();
	const quickReactions = createMemo(() => topEmoji(emojiUsage(), 3));

	const {
		message,
		isPending,
		editMode,
		isAdmin,
		messageEditable,
		isRepliedTo,
		containsMentionOrIsReplyToUser,
		isFocused,
		emojiPopoverOpen,
		setEmojiPopoverOpen,
		contextMenuOpen,
		setContextMenuOpen,
		setLinkTarget,
		setDeletionModalOpen,
		newText,
		handlePotentialDeletion,
		handlePotentialBlock,
		enableReplyMode,
		enableEditMode,
		addReactionOptimistic,
		removeReaction,
		openReactionsViewer,
		visibleEmbedUris,
		canModerateEmbeds,
		removeEmbed,
		modRemoveEmbed,
		openEmbedsModal,
	} = useMessageContext();

	const embedRemover = (uri: string): ((e: MouseEvent) => void) | undefined => {
		if (!isRemovableEmbed(uri)) return undefined;
		const owns = message.author.did === user.did;
		if (!owns && !canModerateEmbeds()) return undefined;

		return (e: MouseEvent) => {
			if (e.shiftKey) {
				void (owns ? removeEmbed(uri) : modRemoveEmbed(uri));
				return;
			}
			openEmbedsModal(uri);
		};
	};

	// `message.author` is a snapshot captured when the message arrived over the
	// socket; `user_event` only updates the community roster, not stored messages.
	// Prefer the live member record so profile changes (avatar/name/status)
	// propagate to already-rendered messages, falling back to the embedded
	// snapshot for non-members / cross-community authors.
	const resolveAuthor = (author: ActorData): ActorData =>
		community().members.find((m) => m.did === author.did) ?? author;

	const resolveReactor = useReactorResolver();

	createEffect(() => {
		if (channel.emptyEditPendingDeletion()?.uri === message.uri) {
			setDeletionModalOpen(true);
			channel.clearEmptyEditPendingDeletion();
		}
	});

	const isSubsequentMessage = () => {
		if (message.parent) return false;
		if (!props.isSubsequent) return false;
		return true;
	};

	const linkFacets = (): Array<ColibriRichTextLink> =>
		message.facets
			?.filter(
				(f) => f.features[0].$type === "social.colibri.richtext.facet#link",
			)
			.map((f) => f.features[0] as ColibriRichTextLink) || [];

	const isLoneMediaLink = (): boolean => {
		const links = linkFacets();
		return (
			links.length === 1 &&
			isDirectMediaUrl(links[0].uri) &&
			!isBrokenMediaLink(links[0].uri) &&
			message.text.trim() === links[0].uri
		);
	};

	const REPLY_SWIPE_THRESHOLD = 60;
	const MAX_REPLY_DRAG = 88;

	const [dragX, setDragX] = createSignal(0);
	const [dragging, setDragging] = createSignal(false);

	const swipeReplyEnabled = () =>
		isTouch() &&
		!isPending() &&
		preferences().controls.swipeLeftAction === "reply";
	const doubleTapEnabled = () =>
		isTouch() && !isPending() && preferences().controls.doubleTapEnabled;

	const replyRevealProgress = () =>
		Math.min(1, Math.abs(dragX()) / REPLY_SWIPE_THRESHOLD);

	const needsMarginSpacing = () =>
		props.isLast || containsMentionOrIsReplyToUser();

	const innerTopSpacingClass = () => (isSubsequentMessage() ? "pt-0" : "pt-1");

	const outerBottomSpacingClass = () => {
		if (!needsMarginSpacing()) return "";
		if (props.hasSubsequent) return "mb-0.5";
		return "";
	};

	const innerBottomSpacingClass = () => {
		if (needsMarginSpacing()) return "";
		if (props.hasSubsequent) return "pb-0.5";
		return "pb-0";
	};

	const handleDoubleTap = () => {
		const controls = preferences().controls;
		if (controls.doubleTapAction === "react") {
			addReactionOptimistic(controls.doubleTapReactionEmoji);
		} else if (messageEditable()) {
			enableEditMode();
		} else {
			enableReplyMode();
		}
	};

	return (
		<MessageContextMenu
			classList={{
				"mt-2": !isSubsequentMessage(),
			}}
		>
			<div
				class="relative w-full"
				classList={{
					"overflow-x-hidden": swipeReplyEnabled(),
					...(outerBottomSpacingClass()
						? { [outerBottomSpacingClass()]: true }
						: {}),
				}}
			>
				<Show when={swipeReplyEnabled() && dragging()}>
					<div class="absolute inset-0 bg-primary pointer-events-none">
						<div
							class="absolute top-1/2 text-primary-foreground"
							style={{
								right: `${Math.max(4, Math.abs(dragX()) / 2 - 10)}px`,
								opacity: replyRevealProgress(),
								transform: `translateY(-50%) translateX(${(1 - replyRevealProgress()) * 24}px)`,
							}}
						>
							<ArrowBendUpLeft class="size-5" />
						</div>
					</div>
				</Show>
				<div
					ref={(el) => {
						const captureLinkTarget = (event: Event) => {
							setLinkTarget(resolveLinkTarget(event.target));
						};

						el.addEventListener("contextmenu", captureLinkTarget, {
							capture: true,
						});

						onCleanup(() =>
							el.removeEventListener("contextmenu", captureLinkTarget, {
								capture: true,
							}),
						);

						createLongPress(el, {
							enabled: () => isTouch() && !isPending(),
							shouldStart: (e) => {
								const target = e.target as Element | null;
								return (
									!target?.closest?.("[data-member-menu]") &&
									!target?.closest?.("[data-reaction-pill]")
								);
							},
							onLongPress: (e) => {
								captureLinkTarget(e);
								setContextMenuOpen(true);
							},
						});

						createSwipe(el, {
							enabled: swipeReplyEnabled,
							threshold: REPLY_SWIPE_THRESHOLD,
							onSwipeLeft: enableReplyMode,
							onSwipeMove: (dx) => {
								batch(() => {
									if (dx === null) {
										setDragging(false);
										setDragX(0);
										return;
									}
									setDragging(true);
									setDragX(Math.min(0, Math.max(dx, -MAX_REPLY_DRAG)));
								});
							},
						});
						createDoubleTap(el, {
							enabled: doubleTapEnabled,
							onDoubleTap: handleDoubleTap,
						});
					}}
					class={`w-full h-fit flex flex-col pr-4 pl-3.5 gap-1 group border-l-2 relative hover:bg-card/50`}
					style={{
						transform: dragX() !== 0 ? `translateX(${dragX()}px)` : undefined,
						"border-radius": dragging()
							? `${replyRevealProgress() * 16}px`
							: undefined,
					}}
					data-message-uri={message.uri}
					classList={{
						[innerTopSpacingClass()]: true,
						"swipe-owns-x": swipeReplyEnabled(),
						"border-transparent": !isRepliedTo(),
						"bg-primary/10 hover:bg-primary/15! border-primary!":
							containsMentionOrIsReplyToUser(),
						"bg-blue-500/5 hover:bg-blue-500/10! border-blue-500":
							isRepliedTo(),
						"bg-yellow-500/10 border-yellow-500": editMode() && isMobile(),
						"bg-blue-500/15": isFocused(),
						"bg-muted/60! hover:bg-muted/60!": contextMenuOpen(),
						"bg-card!": dragging(),
						"transition-colors duration-75": !dragging(),
						"transition-[transform,border-radius] duration-150 ease-out":
							!dragging(),
						...(innerBottomSpacingClass()
							? { [innerBottomSpacingClass()]: true }
							: {}),
					}}
				>
					<BlockDrawer />
					<DeletionDrawer />
					<Show when={message.parent}>
						<div class="flex flex-row gap-4 group/reply cursor-pointer w-full max-w-full">
							<button
								type="button"
								class="before:w-8 before:block before:h-2 before:border-t before:border-l before:border-muted-foreground/50 before:rounded-tl-sm w-10 h-4 relative before:absolute before:translate-y-0.75 before:left-5.5 before:transform before:-translate-x-1 group-hover/reply:before:border-foreground cursor-pointer"
								onClick={() => channel.jumpToMessage(message.parent!.uri)}
							/>
							<div
								class="flex flex-row items-center gap-2 group-hover/reply:text-foreground w-full max-w-[calc(100%-4rem)]"
								onClick={() => channel.jumpToMessage(message.parent!.uri)}
							>
								<User.Avatar
									user={resolveAuthor(message.parent!.author)}
									size="small"
									disableState
								/>
								<strong class="text-xs block">
									<User.DisplayableName
										user={resolveAuthor(message.parent!.author)}
									/>
								</strong>
								<span class="text-xs overflow-hidden text-ellipsis text-nowrap flex-1">
									{message.parent!.text}
								</span>
							</div>
						</div>
					</Show>
					<div class="flex flex-row gap-4">
						<Switch>
							<Match when={!isSubsequentMessage()}>
								<MemberContextMenu
									member={resolveAuthor(message.author)}
									class="contents"
									disabled={isPending() || contextMenuOpen()}
								>
									<User.ProfilePopover
										user={resolveAuthor(message.author)}
										class="w-10 h-10 rounded-full cursor-pointer pt-0.5"
										disabled={isPending()}
									>
										<User.Avatar
											user={resolveAuthor(message.author)}
											disableState
										/>
									</User.ProfilePopover>
								</MemberContextMenu>
							</Match>
							<Match when={isSubsequentMessage()}>
								<div class="w-10 h-8 min-w-10 min-h-8 text-muted-foreground group-hover:opacity-100 opacity-0 text-xs flex items-center justify-center">
									<span class="whitespace-nowrap">
										{new Date(message.createdAt).toLocaleTimeString(undefined, {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
							</Match>
						</Switch>
						<Show
							when={
								!("hash" in message) &&
								(((message.attachments || []).length > 0 &&
									message.text.trim().length === 0) ||
									isLoneMediaLink())
							}
						>
							<div
								class="pb-2 flex flex-col gap-1 w-full max-w-[calc(100%-4rem)]"
								classList={{
									"pt-2": isSubsequentMessage(),
								}}
							>
								<Show when={!isSubsequentMessage()}>
									<div class="flex gap-2 text-sm items-baseline flex-wrap">
										<MemberContextMenu
											member={resolveAuthor(message.author)}
											class="contents"
											disabled={isPending() || contextMenuOpen()}
										>
											<User.ProfilePopover
												user={resolveAuthor(message.author)}
												disabled={isPending()}
											>
												<span class="font-bold cursor-pointer">
													<User.DisplayableName
														user={resolveAuthor(message.author)}
														underlineOnHover
													/>
												</span>
											</User.ProfilePopover>
										</MemberContextMenu>
										<small class="text-muted-foreground">
											<MessageTimestamp datetime={message.createdAt} />
										</small>
										<Show when={message.edited}>
											<small class="text-muted-foreground">(edited)</small>
										</Show>
									</div>
								</Show>

								<Show when={editMode() && !isMobile()}>
									<InlineEditor />
								</Show>
								<Show
									when={isLoneMediaLink()}
									fallback={
										<MessageAttachments
											did={message.author.did}
											attachments={message.attachments || []}
										/>
									}
								>
									<SectionBoundary name="embed" compact>
										<Embed uri={linkFacets()[0].uri} />
									</SectionBoundary>
								</Show>
							</div>
						</Show>
						<Show when={message.text.trim().length > 0 && !isLoneMediaLink()}>
							<div class="flex flex-col w-full min-w-0 justify-center">
								<Show when={!isSubsequentMessage()}>
									<div class="flex gap-2 text-sm items-baseline flex-wrap">
										<MemberContextMenu
											member={resolveAuthor(message.author)}
											class="contents"
											disabled={isPending() || contextMenuOpen()}
										>
											<User.ProfilePopover
												user={resolveAuthor(message.author)}
												disabled={isPending()}
											>
												<div class="flex flex-row items-center gap-2">
													<span class="font-bold cursor-pointer">
														<User.DisplayableName
															user={resolveAuthor(message.author)}
															underlineOnHover
														/>
													</span>
												</div>
											</User.ProfilePopover>
										</MemberContextMenu>
										<small class="text-muted-foreground">
											<MessageTimestamp datetime={message.createdAt} />
										</small>
										<Show when={message.edited}>
											<small class="text-muted-foreground">(edited)</small>
										</Show>
									</div>
								</Show>
								<div>
									<Switch>
										<Match when={!editMode() || isMobile()}>
											<RichTextRenderer
												text={newText}
												isEdited={isSubsequentMessage() && message.edited}
												classList={{
													"text-muted-foreground": isPending(),
													"text-foreground": !isPending(),
												}}
											/>
										</Match>
										<Match when={editMode() && !isMobile()}>
											<InlineEditor />
										</Match>
									</Switch>
								</div>
							</div>
						</Show>
						<Show when={!isPending() && !isMobile()}>
							<div
								class="absolute top-0 right-4 transform -translate-y-1/2 flex flex-row items-center h-8 bg-card border border-border rounded-sm overflow-hidden z-10"
								classList={{
									"invisible pointer-events-none group-hover:visible group-hover:pointer-events-auto":
										!emojiPopoverOpen(),
								}}
							>
								<For each={quickReactions()}>
									{(emoji) => (
										<Action
											tooltipText={reactTooltip(emoji)}
											onClick={() => void addReactionOptimistic(emoji)}
										>
											<img
												src={twemojiImageSrc(emoji)}
												alt={emoji}
												class="size-[1.1em] object-contain"
												loading="lazy"
												decoding="async"
											/>
										</Action>
									)}
								</For>
								<div class="w-px shrink-0 self-stretch bg-border" />
								<EmojiPopover
									emojiPopoverOpen={emojiPopoverOpen}
									setEmojiPopoverOpen={setEmojiPopoverOpen}
									addReactionOptimistic={addReactionOptimistic}
								>
									<Action tooltipText="Add reaction">
										<SmileyIcon />
									</Action>
								</EmojiPopover>
								<Action tooltipText="Reply" onClick={enableReplyMode}>
									<ArrowBendUpLeft />
								</Action>
								<Show when={isAdmin() && message.author.did !== user.did}>
									<Action
										tooltipText="Block"
										buttonClasses="text-destructive"
										onClick={(e) => {
											handlePotentialBlock(e);
										}}
									>
										<ProhibitIcon />
									</Action>
								</Show>
								<Show when={messageEditable()}>
									<Action tooltipText="Edit" onClick={enableEditMode}>
										<PencilIcon />
									</Action>
									<Action
										tooltipText="Delete"
										buttonClasses="text-destructive"
										onClick={(e) => {
											handlePotentialDeletion(e);
										}}
									>
										<TrashIcon />
									</Action>
								</Show>
							</div>
						</Show>
					</div>
					<Show
						when={
							!("hash" in message) &&
							(message.attachments || []).length > 0 &&
							message.text.trim().length > 0
						}
					>
						<div class="pl-14 pb-2">
							<MessageAttachments
								did={message.author.did}
								attachments={message.attachments || []}
							/>
						</div>
					</Show>
					<Show
						when={
							visibleEmbedUris().length > 0 &&
							!("hash" in message) &&
							!isLoneMediaLink()
						}
					>
						<div class="flex flex-row flex-wrap gap-4 pl-14 min-w-0">
							<For each={visibleEmbedUris()}>
								{(uri) => (
									<SectionBoundary name="embed" compact>
										<Embed uri={uri} onRemove={embedRemover(uri)} />
									</SectionBoundary>
								)}
							</For>
						</div>
					</Show>
					<Show when={message.reactions.length > 0}>
						<div
							data-reaction-pill
							ref={(el) => {
								createLongPress(el, {
									enabled: () => isTouch() && !isPending(),
									onLongPress: (e) => {
										const pill = (e.target as Element | null)?.closest?.(
											"[data-reaction-pill]",
										);

										openReactionsViewer(
											pill?.getAttribute("data-reaction-pill") || undefined,
										);
									},
								});
							}}
							class="flex flex-row gap-1 flex-wrap items-center pl-14 pb-2"
						>
							<For each={message.reactions}>
								{(item) => (
									<Tooltip>
										<TooltipTrigger
											as={(tooltipProps: TooltipTriggerProps) => (
												<button
													type="button"
													data-reaction-pill={item.emoji}
													class="border rounded-sm hover:bg-card px-1.5 py-1 flex gap-1 items-center cursor-pointer"
													classList={{
														"border-primary bg-primary/15 hover:bg-primary/25":
															item.reactorDIDs.includes(user.did),
														"border-border bg-card hover:bg-muted":
															!item.reactorDIDs.includes(user.did),
													}}
													{...tooltipProps}
													onClick={() => {
														const reactionIndex = item.reactorDIDs.indexOf(
															user.did,
														);

														if (reactionIndex !== -1) {
															removeReaction(item.emoji);
														} else {
															addReactionOptimistic(item.emoji);
														}
													}}
												>
													<span
														class="h-4 w-4 flex items-center justify-center"
														innerHTML={parseEmojiText(item.emoji)}
													/>
													<span class="text-muted-foreground text-sm">
														{item.count}
													</span>
												</button>
											)}
										/>
										<TooltipPortal>
											<TooltipContent>
												<div class="flex max-w-64 flex-col gap-1.5">
													<div class="flex flex-row items-center gap-1">
														<For each={item.reactorDIDs.slice(0, 6)}>
															{(did) => (
																<User.Avatar
																	user={resolveReactor(did)}
																	size="small"
																	disableState
																	class="size-5"
																/>
															)}
														</For>
													</div>
													<p class="m-0 text-wrap">
														{reactedByLabel(item.reactorDIDs, resolveReactor)}{" "}
														reacted
														<Show when={emojiShortcode(item.emoji)}>
															{(shortcode) => <> with :{shortcode()}:</>}
														</Show>
													</p>
												</div>
											</TooltipContent>
										</TooltipPortal>
									</Tooltip>
								)}
							</For>
						</div>
						<ReactionsViewer />
					</Show>
				</div>
			</div>
		</MessageContextMenu>
	);
};
