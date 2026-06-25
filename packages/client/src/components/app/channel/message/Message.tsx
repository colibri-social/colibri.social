import type { ActorData, ColibriRichTextLink } from "@colibri-social/lib";
import twemoji from "@twemoji/api";
import { type Component, For, Match, Show, Switch } from "solid-js";
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
import {
	Tooltip,
	TooltipTrigger,
	type TooltipTriggerProps,
} from "../../../ui/Tooltip";
import { EmojiPopover } from "../../common/EmojiPopover";
import { RichTextRenderer } from "../../common/rich-text-renderer/RichTextRenderer";
import { facetsToProseMirror } from "../../common/text-editor/facets-to-prosemirror";
import { TextEditor } from "../../common/text-editor/TextEditor";
import User from "../../user";
import { MessageAttachments } from "./Attachments";
import { BlockDrawer } from "./BlockDrawer";
import { Action } from "./ContextMenu";
import { MessageContextMenu } from "./ContextMenu/Menu";
import { DeletionDrawer } from "./DeletionDrawer/index";
import { Embed } from "./Embed";

/**
 * A rendered message component in a chat.
 */
export const Message: Component<{
	data: MessageData;
	isSubsequent: boolean;
	hasSubsequent: boolean;
	disabled?: boolean;
}> = (props) => {
	return (
		<MessageContextProvider data={props.data}>
			<MessageInner
				isSubsequent={props.isSubsequent}
				hasSubsequent={props.hasSubsequent}
				disabled={props.disabled}
			/>
		</MessageContextProvider>
	);
};

const MessageInner: Component<{
	isSubsequent: boolean;
	hasSubsequent: boolean;
	disabled?: boolean;
}> = (props) => {
	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();

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
		newText,
		editedText,
		setEditedText,
		handlePotentialDeletion,
		handlePotentialBlock,
		enableReplyMode,
		enableEditMode,
		cancelEdits,
		submitEdits,
		addReactionOptimistic,
		removeReaction,
	} = useMessageContext();

	// `message.author` is a snapshot captured when the message arrived over the
	// socket; `user_event` only updates the community roster, not stored messages.
	// Prefer the live member record so profile changes (avatar/name/status)
	// propagate to already-rendered messages, falling back to the embedded
	// snapshot for non-members / cross-community authors.
	const resolveAuthor = (author: ActorData): ActorData =>
		community().members.find((m) => m.did === author.did) ?? author;

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

	return (
		<MessageContextMenu>
			<div
				class={`w-full h-fit flex flex-col pr-4 pl-3.5 gap-1 group border-l-2 relative hover:bg-card/50 transition-colors duration-75`}
				data-message={JSON.stringify(message)}
				data-message-uri={message.uri}
				classList={{
					"pb-0 pt-0.5": isSubsequentMessage(),
					"pb-0 pt-1 mt-2": !isSubsequentMessage(),
					"border-transparent": !isRepliedTo(),
					"bg-primary/10 hover:bg-primary/15! border-primary!":
						containsMentionOrIsReplyToUser(),
					"bg-blue-500/5 hover:bg-blue-500/10! border-blue-500": isRepliedTo(),
					"bg-blue-500/15": isFocused(),
					"pb-0.5": props.hasSubsequent,
					"pb-2": message.reactions.length > 0,
				}}
			>
				<BlockDrawer />
				<DeletionDrawer />
				<Show when={message.parent}>
					<div class="flex flex-row gap-4 group/reply cursor-pointer w-full max-w-full">
						<button
							type="button"
							class="before:w-8 before:block before:h-2 before:border-t before:border-l before:border-muted-foreground/50 before:rounded-tl-sm w-10 h-4 relative before:absolute before:left-5.5 before:transform before:-translate-x-1 group-hover/reply:before:border-foreground cursor-pointer"
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
							<User.ProfilePopover
								user={resolveAuthor(message.author)}
								class="w-10 h-10 rounded-full cursor-pointer"
								disabled={isPending()}
							>
								<User.Avatar
									user={resolveAuthor(message.author)}
									disableState
								/>
							</User.ProfilePopover>
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
							(message.attachments || []).length > 0 &&
							message.text.trim().length === 0
						}
					>
						<div
							class="pb-2 flex flex-col gap-1"
							classList={{
								"pt-2": isSubsequentMessage(),
							}}
						>
							<Show when={!isSubsequentMessage()}>
								<div class="flex gap-2 text-sm items-baseline">
									<User.ProfilePopover
										user={resolveAuthor(message.author)}
										disabled={isPending()}
									>
										<span class="font-bold hover:underline cursor-pointer">
											<User.DisplayableName
												user={resolveAuthor(message.author)}
											/>
										</span>
									</User.ProfilePopover>
									<small class="text-muted-foreground">
										{new Date(message.createdAt).toLocaleDateString()}{" "}
										{new Date(message.createdAt).toLocaleTimeString(undefined, {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</small>
									<Show when={message.edited}>
										<small class="text-muted-foreground">(edited)</small>
									</Show>
								</div>
							</Show>

							<MessageAttachments
								did={message.author.did}
								attachments={message.attachments || []}
							/>
						</div>
					</Show>
					<Show when={message.text.trim().length > 0}>
						<div class="flex flex-col w-full justify-center">
							<Show when={!isSubsequentMessage()}>
								<div class="flex gap-2 text-sm items-baseline">
									<User.ProfilePopover
										user={resolveAuthor(message.author)}
										disabled={isPending()}
									>
										<span class="font-bold hover:underline cursor-pointer">
											<User.DisplayableName
												user={resolveAuthor(message.author)}
											/>
										</span>
									</User.ProfilePopover>
									<small class="text-muted-foreground">
										{new Date(message.createdAt).toLocaleDateString()}{" "}
										{new Date(message.createdAt).toLocaleTimeString(undefined, {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</small>
									<Show when={message.edited}>
										<small class="text-muted-foreground">(edited)</small>
									</Show>
								</div>
							</Show>
							<div>
								<Switch>
									<Match when={!editMode()}>
										<RichTextRenderer
											text={newText}
											isEdited={isSubsequentMessage() && message.edited}
											classList={{
												"text-muted-foreground": isPending(),
												"text-foreground": !isPending(),
											}}
										/>
									</Match>
									<Match when={editMode()}>
										<div class="w-full">
											<TextEditor
												text={facetsToProseMirror(
													newText().text,
													newText().facets || [],
													community().members || [],
													community().channels || [],
												)}
												placeholder=""
												submitOnEnter
												onChange={(text, facets) => {
													setEditedText({ text, facets });
												}}
												sendMessage={async (text, facets) => {
													submitEdits(text, facets);
													return false;
												}}
												onEscape={cancelEdits}
											/>
										</div>
										<div class="flex flex-row items-center gap-1">
											<small>
												escape to{" "}
												<button
													type="button"
													class="cursor-pointer hover:underline text-primary-foreground"
													onClick={cancelEdits}
												>
													cancel
												</button>
											</small>
											<span class="w-1 h-1 bg-muted-foreground rounded-full" />
											<small>
												enter to{" "}
												<button
													type="button"
													class="cursor-pointer hover:underline text-primary-foreground"
													onClick={() =>
														submitEdits(editedText().text, editedText().facets)
													}
												>
													submit
												</button>
											</small>
										</div>
									</Match>
								</Switch>
							</div>
						</div>
					</Show>
					<Show when={!isPending()}>
						<div
							class="absolute top-0 right-4 transform -translate-y-1/2 flex flex-row h-8 bg-card border border-border rounded-sm overflow-hidden z-10"
							classList={{
								"invisible pointer-events-none group-hover:visible group-hover:pointer-events-auto":
									!emojiPopoverOpen(),
							}}
						>
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
				<Show when={linkFacets().length > 0 && !("hash" in message)}>
					<div class="flex flex-row flex-wrap gap-4 pl-14">
						<For each={linkFacets()}>{(item) => <Embed uri={item.uri} />}</For>
					</div>
				</Show>
				<Show when={message.reactions.length > 0}>
					<div class="flex flex-row gap-1 flex-wrap items-center pl-14">
						<For each={message.reactions}>
							{(item) => (
								<Tooltip>
									<TooltipTrigger
										as={(tooltipProps: TooltipTriggerProps) => (
											<button
												type="button"
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
													class="h-4 w-4"
													innerHTML={twemoji.parse(item.emoji)}
												/>
												<span class="text-muted-foreground text-sm">
													{item.count}
												</span>
											</button>
										)}
									/>
									{/*TODO: Investigate feasability for this */}
									{/*<TooltipPortal>
										<TooltipContent>
											<p class="m-0 max-w-64 text-wrap">
												<span>Reacted by </span>
												<For each={item.reactorDIDs}>
													{(author, index) => (
														<Suspense
															fallback={<div class="inline">......</div>}
														>
															<SmallUserAsync did={author} hideImage />
															<Show when={index() < item.authors.length - 1}>
																{", "}
															</Show>
														</Suspense>
													)}
												</For>
											</p>
										</TooltipContent>
									</TooltipPortal>*/}
								</Tooltip>
							)}
						</For>
					</div>
				</Show>
			</div>
		</MessageContextMenu>
	);
};
