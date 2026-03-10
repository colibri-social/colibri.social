import { actions } from "astro:actions";
import { useParams } from "@solidjs/router";
import twemoji from "@twemoji/api";
import {
	type Component,
	createSignal,
	For,
	Match,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import type { ColibriRichTextLink } from "@/utils/atproto/rich-text/detection";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import type {
	CommunityData,
	DBMessageData,
	IndexedMessageData,
	MessageReactionData,
} from "@/utils/sdk";
import {
	type PendingMessageData,
	type ReactionAddedEvent,
	type ReactionRemovedEvent,
	useGlobalContext,
} from "../../contexts/GlobalContext";
import { useMessageContext } from "../../contexts/MessageContext";
import { Emoji as EmojiIcon } from "../../icons/Emoji";
import { Pencil } from "../../icons/Pencil";
import { Prohibit } from "../../icons/Prohibit";
import { Reply } from "../../icons/Reply";
import { Trash } from "../../icons/Trash";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
	type TooltipTriggerProps,
} from "../../shadcn-solid/Tooltip";
import { RichTextRenderer, type TextWithFacets } from "../RichTextRenderer";
import { SmallUser } from "../SmallUser";
import { MessageAttachments } from "./Attachments";
import { EmojiPopover } from "./EmojiPopover";
import { LinkEmbed } from "./LinkEmbed";
import { MessageAction } from "./MessageAction";
import { MessageBlockDrawer } from "./MessageBlockDrawer";
import { MessageContextMenu } from "./MessageContextMenu";
import { MessageDeletionDrawer } from "./MessageDeletionDrawer";
import { blockMessage, deleteMessage } from "./util";

/**
 * A rendered message component in a chat.
 */
export const Message: Component<{
	data: IndexedMessageData | PendingMessageData;
	isSubsequent: boolean;
	community: CommunityData;
}> = (props) => {
	const params = useParams();
	const [
		messageData,
		{ setReplyingTo, jumpToMessage, setEditingMessage, clearEditingMessage },
	] = useMessageContext();
	const [globalData, { addDeletedMessage, addReactionListener }] =
		useGlobalContext();
	const isPending = () => "hash" in props.data;
	const [blockModalOpen, setBlockModalOpen] = createSignal(false);
	const [deletionModalOpen, setDeletionModalOpen] = createSignal(false);
	const [emojiPopoverOpen, setEmojiPopoverOpen] = createSignal(false);
	const [debugModalOpen, setDebugModalOpen] = createSignal(false);
	const [additionalReactions, setAdditionalReactions] = createSignal<
		Array<ReactionAddedEvent>
	>([]);
	const [removedReactions, setRemovedReactions] = createSignal<
		Array<ReactionRemovedEvent>
	>([]);
	const [_, setPendingCounter] = createSignal(0);
	const editMode = () =>
		!isPending() &&
		messageData.editingMessageRkey === (props.data as IndexedMessageData).rkey;
	const [editedText, setEditedText] = createSignal<TextWithFacets>({
		text: props.data.text,
		facets: props.data.facets || [],
	});
	const community = () => params.community!;

	/**
	 * Optimistically add a reaction emoji to a message, even though the server has not responded yet.
	 * Replaces the reaction with the proper one should the server respond with a success and will remove it
	 * if the server errors out.
	 * @param emoji The emoji to react with.
	 */
	const addReactionOptimistic = (emoji: string) => {
		const tempRkey = `__pending_${setPendingCounter((c) => c + 1)}`;
		const messageRkey = (props.data as IndexedMessageData).rkey;

		setAdditionalReactions((current) => [
			...current,
			{
				author_did: globalData.user.sub,
				rkey: tempRkey,
				target_rkey: messageRkey,
				target_author_did: props.data.author_did,
				channel: props.data.channel,
				emoji,
				type: "reaction_added",
			},
		]);

		setRemovedReactions((current) =>
			current.filter(
				(x) =>
					x.emoji !== emoji &&
					x.author_did !== globalData.user.sub &&
					x.target_rkey !== (props.data as IndexedMessageData).rkey,
			),
		);

		actions
			.addReaction({
				emoji,
				message: messageRkey,
			})
			.then((result) => {
				if (result.error) {
					setAdditionalReactions((current) =>
						current.filter((r) => r.rkey !== tempRkey),
					);
					toast.error("Failed to add reaction", {
						description: parseZodToErrorOrDisplay(result.error.message),
					});
					return;
				}

				const wasRemoved = removedReactions().some((r) => r.rkey === tempRkey);

				if (wasRemoved) {
					const removedReaction = actions.removeReaction({
						rkey: result.data.rkey,
					});
					setAdditionalReactions((current) =>
						current.filter((r) => r.rkey !== tempRkey),
					);
					setRemovedReactions((current) =>
						current.filter((r) => r.rkey !== tempRkey),
					);

					removedReaction.then((res) => {
						if (res.error) {
							toast.error("Failed to remove reaction", {
								description: parseZodToErrorOrDisplay(res.error.message),
							});

							setAdditionalReactions((current) => [
								...current,
								{
									author_did: globalData.user.sub,
									rkey: result.data.rkey,
									target_rkey: messageRkey,
									target_author_did: props.data.author_did,
									channel: props.data.channel,
									emoji,
									type: "reaction_added",
								},
							]);

							return;
						}
					});
				} else {
					setAdditionalReactions((current) =>
						current.map((r) =>
							r.rkey === tempRkey ? { ...r, rkey: result.data.rkey } : r,
						),
					);
				}
			});
	};

	/**
	 * Enables reply mode.
	 */
	const enableReplyMode = () => {
		if (isPending()) return;

		setReplyingTo(props.data as IndexedMessageData);
	};

	/**
	 * Enables edit mode for this message.
	 */
	const enableEditMode = () => {
		if (isPending()) return;
		setEditingMessage((props.data as IndexedMessageData).rkey);
	};

	/**
	 * Resets all edits made on this message and disables edit mode.
	 */
	const cancelEdits = () => {
		setEditedText({
			text: props.data.text,
			facets: props.data.facets || [],
		});
		clearEditingMessage();
	};

	/**
	 * Saves edits to the PDS.
	 */
	const submitEdits = async () => {
		if ("hash" in props.data) return;

		clearEditingMessage();

		if (editedText().text.trim().length === 0) {
			setDeletionModalOpen(true);
			return;
		}

		const { error } = await actions.editMessage({
			channel: props.data.channel,
			facets: editedText().facets,
			text: editedText().text,
			rkey: props.data.rkey,
		});

		if (error) {
			toast.error("Failed to edit message", {
				description: parseZodToErrorOrDisplay(error.message),
			});
			// Restore edit mode so the user can retry without losing their changes
			setEditingMessage((props.data as IndexedMessageData).rkey);
		}
	};

	/**
	 * Handles a potential deletion by either opening the modal or immediately deleting the message if the shift key is held while clicking.
	 * @param e The click event.
	 */
	const handlePotentialDeletion = (e: MouseEvent) => {
		if (isPending()) return;

		if (e.shiftKey) {
			return deleteMessage(props.data as IndexedMessageData, addDeletedMessage);
		}

		setDeletionModalOpen(true);
	};

	/**
	 * Handles a potential block by either opening the modal or immediately blocking the message if the shift key is held while clicking.
	 * @param e The click event.
	 */
	const handlePotentialBlock = (e: MouseEvent) => {
		if (isPending()) return;

		if (e.shiftKey) {
			return blockMessage(
				props.data as IndexedMessageData,
				addDeletedMessage,
				community(),
				setBlockModalOpen,
			);
		}

		setBlockModalOpen(true);
	};

	/**
	 * A derived signal to check whether a message is in reply to another message.
	 * @returns Whether the message is in reply to another message or not.
	 */
	const isRepliedTo = () => {
		if ("hash" in props.data) return;

		return (
			messageData.replyingTo?.author_did === globalData.user.sub &&
			messageData.replyingTo?.rkey === props.data.rkey
		);
	};

	/**
	 * A derived signal to check whether this is a subsequent message or not.
	 * @returns Whether this is a subsequent message or not.
	 */
	const isSubsequentMessage = () => {
		if (props.data.parent_message) {
			return false;
		}

		if (!props.isSubsequent) return false;

		return true;
	};

	/**
	 * A derived signal to check whether a message is focused or not.
	 * @returns Whether a message is focused or not.
	 */
	const isFocused = () => {
		if ("hash" in props.data) return false;

		return (
			messageData.focusedMessage?.author_did === props.data.author_did &&
			messageData.focusedMessage.rkey === props.data.rkey
		);
	};

	/**
	 * A derived signal to check if a message is editable or not.
	 * @returns Whether the message is editable or not.
	 */
	const messageEditable = () => props.data.author_did === globalData.user.sub;

	/**
	 * A derived signal that computes an array of reaction data, grouping reactions
	 * by their emoji.
	 * @returns A sorted array of reactions, their emoji, count, author DIDs and record keys.
	 */
	const messageReactions = (): Array<MessageReactionData> => {
		const existingReactions = props.data.reactions.map((r) => ({
			...r,
			authors: [...r.authors],
			rkeys: [...r.rkeys],
		}));

		for (const reaction of additionalReactions()) {
			const existingEntry = existingReactions.find(
				(x) => x.emoji === reaction.emoji,
			);

			if (!existingEntry) {
				existingReactions.push({
					authors: [reaction.author_did],
					rkeys: [reaction.rkey],
					count: 1,
					emoji: reaction.emoji,
				});
			} else {
				if (!existingEntry.authors.some((x) => x === reaction.author_did)) {
					existingEntry.authors.push(reaction.author_did);
					existingEntry.rkeys.push(reaction.rkey);
					existingEntry.count++;
				}
			}
		}

		for (const reaction of removedReactions()) {
			const existingEntry = existingReactions.find(
				(x) => x.emoji === reaction.emoji,
			);

			if (!existingEntry) continue;

			existingEntry.authors = existingEntry.authors.filter(
				(x) => x !== reaction.author_did,
			);
			existingEntry.rkeys = existingEntry.rkeys.filter(
				(x) => x !== reaction.rkey,
			);
			existingEntry.count--;
		}

		return existingReactions.filter((r) => r.count > 0);
	};

	/**
	 * Optimistic updates for reactions coming in via the websocket
	 */
	addReactionListener((data) => {
		if (isPending()) return;

		if (
			data.target_rkey !== (props.data as IndexedMessageData).rkey ||
			data.target_author_did !== props.data.author_did
		) {
			return;
		}

		// We have already handled this addition optimistically
		if (data.author_did === globalData.user.sub) return;

		if (data.type === "reaction_added") {
			setAdditionalReactions((current) => [...current, data]);
		} else {
			setRemovedReactions((current) => [...current, data]);
		}
	});

	const linkFacets = (): Array<ColibriRichTextLink> =>
		props.data.facets
			?.filter(
				(f) => f.features[0].$type === "social.colibri.richtext.facet#link",
			)
			.map((f) => f.features[0] as ColibriRichTextLink) || [];

	const isAdmin = () => props.community.owner_did === globalData.user.sub;

	return (
		<MessageContextMenu
			data={props.data}
			disabled={isPending()}
			enableEditMode={enableEditMode}
			enableReplyMode={enableReplyMode}
			handlePotentialDeletion={handlePotentialDeletion}
			addDeletedMessage={addDeletedMessage}
			setEmojiPopoverOpen={setEmojiPopoverOpen}
			messageEditable={messageEditable}
			deletionModalOpen={deletionModalOpen()}
			setDeletionModalOpen={setDeletionModalOpen}
			debugModalOpen={debugModalOpen()}
			setDebugModalOpen={setDebugModalOpen}
		>
			<div
				class={`w-full h-fit flex flex-col pr-4 pl-3.5 gap-1 group border-l-2 relative hover:bg-card/50 transition-colors duration-75`}
				data-message={JSON.stringify(props.data)}
				classList={{
					"py-0": isSubsequentMessage(),
					"pb-0 pt-1 mt-2": !isSubsequentMessage(),
					"border-transparent": !isRepliedTo(),
					"bg-primary/15 hover:bg-primary/25 border-primary": isRepliedTo(),
					"bg-primary/15": isFocused(),
					"pb-2": messageReactions().length > 0,
				}}
			>
				<Show when={props.data.parent_message}>
					<div class="flex flex-row gap-4 group/reply cursor-pointer w-fit">
						<button
							type="button"
							class="before:w-8 before:block before:h-2 before:border-t before:border-l before:border-muted-foreground/50 before:rounded-tl-sm w-10 h-4 relative before:absolute before:left-1/2 before:transform before:-translate-x-1 group-hover/reply:before:border-foreground cursor-pointer"
							onClick={() => jumpToMessage(props.data.parent_message!)}
						/>
						<div
							class="flex flex-row items-center gap-2 group-hover/reply:text-foreground"
							onClick={() => jumpToMessage(props.data.parent_message!)}
						>
							<img
								src={
									props.data.parent_message!.avatar_url ||
									"/user-placeholder.png"
								}
								width={16}
								height={16}
								alt={props.data.parent_message!.display_name}
								class="rounded-full"
							/>
							<strong class="text-xs">
								{props.data.parent_message!.display_name}
							</strong>
							<span class="text-xs">{props.data.parent_message!.text}</span>
						</div>
					</div>
				</Show>
				<div class="flex flex-row gap-4">
					<Switch>
						<Match when={!isSubsequentMessage()}>
							<img
								src={props.data.avatar_url || "/user-placeholder.png"}
								alt={props.data.display_name}
								class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
								loading="lazy"
							/>
						</Match>
						<Match when={isSubsequentMessage()}>
							<div class="w-10 h-8 min-w-10 min-h-8 text-muted-foreground group-hover:opacity-100 opacity-0 text-xs flex items-center justify-center">
								<span>
									{new Date(props.data.created_at).toLocaleTimeString(
										undefined,
										{
											hour: "2-digit",
											minute: "2-digit",
										},
									)}
								</span>
							</div>
						</Match>
					</Switch>
					<Show
						when={
							!("hash" in props.data) &&
							(props.data.attachments || []).length > 0 &&
							props.data.text.trim().length === 0
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
									<span class="font-bold">{props.data.display_name}</span>
									<small class="text-muted-foreground">
										{new Date(props.data.created_at).toLocaleDateString()}{" "}
										{new Date(props.data.created_at).toLocaleTimeString(
											undefined,
											{
												hour: "2-digit",
												minute: "2-digit",
											},
										)}
									</small>
									<Show when={props.data.edited}>
										<small class="text-muted-foreground">(edited)</small>
									</Show>
								</div>
							</Show>

							<MessageAttachments
								did={props.data.author_did}
								attachments={(props.data as DBMessageData).attachments || []}
							/>
						</div>
					</Show>
					<Show when={props.data.text.trim().length > 0}>
						<div class="flex flex-col w-full justify-center">
							<Show when={!isSubsequentMessage()}>
								<div class="flex gap-2 text-sm items-baseline">
									<span class="font-bold">{props.data.display_name}</span>
									<small class="text-muted-foreground">
										{new Date(props.data.created_at).toLocaleDateString()}{" "}
										{new Date(props.data.created_at).toLocaleTimeString(
											undefined,
											{
												hour: "2-digit",
												minute: "2-digit",
											},
										)}
									</small>
									<Show when={props.data.edited}>
										<small class="text-muted-foreground">(edited)</small>
									</Show>
								</div>
							</Show>
							<div
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										submitEdits();
									}
									if (e.key === "Escape") {
										cancelEdits();
									}
								}}
							>
								<RichTextRenderer
									text={editedText}
									setInputContent={setEditedText}
									classList={{
										"text-muted-foreground": isPending(),
										"text-foreground": !isPending(),
										"p-4 py-3 border border-border rounded-sm bg-card":
											editMode(),
									}}
									editable={editMode()}
								/>
								<Show when={editMode()}>
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
												onClick={submitEdits}
											>
												submit
											</button>
										</small>
									</div>
								</Show>
							</div>
						</div>
					</Show>
					<Show when={!isPending()}>
						<div
							class="absolute top-0 right-4 transform -translate-y-1/2 flex flex-row h-8 bg-card border border-border rounded-sm overflow-hidden"
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
								<MessageAction tooltipText="Add reaction">
									<EmojiIcon />
								</MessageAction>
							</EmojiPopover>
							<MessageAction tooltipText="Reply" onClick={enableReplyMode}>
								<Reply />
							</MessageAction>
							<Show
								when={
									isAdmin() && props.data.author_did !== globalData.user.sub
								}
							>
								<MessageBlockDrawer
									message={props.data}
									addDeletedMessage={addDeletedMessage}
									open={blockModalOpen()}
									setOpen={setBlockModalOpen}
									community={community()}
								>
									<MessageAction
										tooltipText="Block"
										buttonClasses="text-destructive"
										onClick={(e) => {
											handlePotentialBlock(e);
										}}
									>
										<Prohibit />
									</MessageAction>
								</MessageBlockDrawer>
							</Show>
							<Show when={messageEditable()}>
								<MessageAction tooltipText="Edit" onClick={enableEditMode}>
									<Pencil />
								</MessageAction>
								<MessageDeletionDrawer
									message={props.data}
									addDeletedMessage={addDeletedMessage}
									open={deletionModalOpen()}
									setOpen={setDeletionModalOpen}
								>
									<MessageAction
										tooltipText="Delete"
										buttonClasses="text-destructive"
										onClick={(e) => {
											handlePotentialDeletion(e);
										}}
									>
										<Trash />
									</MessageAction>
								</MessageDeletionDrawer>
							</Show>
						</div>
					</Show>
				</div>
				<Show
					when={
						!("hash" in props.data) &&
						(props.data.attachments || []).length > 0 &&
						props.data.text.trim().length > 0
					}
				>
					<div class="pl-14 pb-2">
						<MessageAttachments
							did={props.data.author_did}
							attachments={(props.data as DBMessageData).attachments || []}
						/>
					</div>
				</Show>
				<Show when={messageReactions().length > 0}>
					<div class="flex flex-row gap-1 flex-wrap items-center pl-14">
						<For each={messageReactions()}>
							{(item) => (
								<Tooltip>
									<TooltipTrigger
										as={(tooltipProps: TooltipTriggerProps) => (
											<button
												type="button"
												class="border rounded-sm hover:bg-card px-1.5 py-1 flex gap-1 items-center cursor-pointer"
												classList={{
													"border-primary bg-primary/15 hover:bg-primary/25":
														item.authors.includes(globalData.user.sub),
													"border-border bg-card hover:bg-muted":
														!item.authors.includes(globalData.user.sub),
												}}
												{...tooltipProps}
												onClick={() => {
													const reactionIndex = item.authors.indexOf(
														globalData.user.sub,
													);

													if (reactionIndex !== -1) {
														const author_did = item.authors[reactionIndex];
														const rkey = item.rkeys[reactionIndex];

														if (!rkey.startsWith("__pending_")) {
															actions
																.removeReaction({
																	rkey,
																})
																.then((res) => {
																	if (res.error) {
																		toast.error("Failed to remove reaction", {
																			description: parseZodToErrorOrDisplay(
																				res.error.message,
																			),
																		});

																		setRemovedReactions((current) =>
																			current.filter((r) => r.rkey !== rkey),
																		);

																		return;
																	}
																});
														}

														setRemovedReactions((current) => [
															...current,
															{
																author_did,
																rkey,
																target_rkey: (props.data as IndexedMessageData)
																	.rkey,
																target_author_did: props.data.author_did,
																channel: props.data.channel,
																emoji: item.emoji,
																type: "reaction_removed",
															},
														]);

														setAdditionalReactions((current) =>
															current.filter(
																(x) =>
																	x.emoji !== item.emoji ||
																	x.author_did !== globalData.user.sub ||
																	x.target_rkey !==
																		(props.data as IndexedMessageData).rkey,
															),
														);
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
									<TooltipPortal>
										<TooltipContent>
											<p class="m-0 max-w-64 text-wrap">
												<span>Reacted by </span>
												<For each={item.authors}>
													{(author, index) => (
														<Suspense
															fallback={<div class="inline">......, </div>}
														>
															<SmallUser did={author} hideImage />
															<Show when={index() < item.authors.length - 1}>
																{", "}
															</Show>
														</Suspense>
													)}
												</For>
											</p>
										</TooltipContent>
									</TooltipPortal>
								</Tooltip>
							)}
						</For>
					</div>
				</Show>
				<Show when={linkFacets().length > 0 && !("hash" in props.data)}>
					<div class="flex flex-row flex-wrap gap-4 pl-14">
						<For each={linkFacets()}>
							{(item) => <LinkEmbed uri={item.uri} />}
						</For>
					</div>
				</Show>
			</div>
		</MessageContextMenu>
	);
};
