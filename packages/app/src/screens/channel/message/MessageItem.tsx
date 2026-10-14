import {
	ConfirmDialog,
	copyText,
	Emoji,
	EmojiPickerPopover,
	ForwardedMessage,
	formatMessageTime,
	HiddenMessage,
	MessageActionsDrawer,
	MessageContextMenu,
	MessageGestures,
	type MessageHighlight,
	type MessageListEntry,
	MessageMenuItems,
	type MessageReply,
	MessageRow,
	MessageSelectFrame,
	MessageToolbar,
	MovedFromLine,
	ReactionBar,
	ReactionsViewer,
	type RichText,
	RichTextRenderer,
	SwipeToReply,
	ThreadCard,
	toast,
} from "@colibri-social/ui";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import {
	splitAttachments,
	visibleEmbeds,
} from "../../../data/adapters/attachments";
import {
	type AuthorDirectory,
	toMessageAuthor,
	viaLabel,
} from "../../../data/adapters/authors";
import {
	mentionsDid,
	previewText,
	toTextValue,
} from "../../../data/adapters/facets";
import {
	type ForwardDisplay,
	toForwardDisplay,
} from "../../../data/adapters/forward";
import {
	customReactionResolver,
	toReactionGroups,
	toReactions,
} from "../../../data/adapters/reactions";
import { formatAge } from "../../../data/adapters/time";
import type { ProfileView } from "../../../data/types";
import { mediaSession } from "../composer/media/session";
import { whenOverlaysClosed } from "../forward/overlay-wait";
import { useChat } from "./chat-context";
import {
	hasAttachmentContent,
	MediaWithLightbox,
	MessageAttachments,
} from "./MessageAttachments";
import {
	type ChatMessage,
	isDeletedParent,
	isHiddenMessage,
	isVisibleParent,
} from "./types";

const DEFAULT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮"];

const unknownProfile = (did: string): ProfileView =>
	({
		did,
		handle: "unknown.invalid",
		displayName: "Unknown user",
		isBot: false,
		syncBluesky: false,
	}) as unknown as ProfileView;

export type MessageItemProps = {
	entry: Accessor<MessageListEntry<ChatMessage>>;
	highlight?: MessageHighlight;
};

export const MessageItem = (props: MessageItemProps) => {
	const chat = useChat();
	const message = () => props.entry().message;
	const view = () => message().view;
	const sent = () => message().state === "sent";
	const anchor = () => !!message().anchor;
	const own = () => message().author === chat.viewer();
	const directory = createMemo<AuthorDirectory>(() => ({
		members: chat.members(),
		roles: chat.roles(),
	}));

	const profile = createMemo(
		() =>
			view()?.author ??
			chat.members().get(message().author)?.actor ??
			unknownProfile(message().author),
	);
	const author = createMemo(() => toMessageAuthor(profile(), directory()));
	const text = createMemo(() => toTextValue(message().text, message().facets));

	const reply = createMemo((): MessageReply | undefined => {
		const parent = message().parent;
		if (isVisibleParent(parent)) {
			return {
				author: toMessageAuthor(parent.author, directory()),
				text:
					previewText(parent.text) ||
					(parent.attachments.length > 0 ? "Sent an attachment" : ""),
				onClick: () => chat.onJumpTo(parent.rkey),
			};
		}
		if (isDeletedParent(parent)) return { unavailable: true };
		return undefined;
	});

	const split = createMemo(() =>
		splitAttachments(
			view()?.attachments ?? message().attachments,
			view() ? undefined : message().uploadProgress,
		),
	);
	const embeds = createMemo(() =>
		visibleEmbeds(view()?.embeds, view()?.suppressedEmbeds),
	);
	const forward = createMemo(() => {
		const value = view()?.forward;
		if (!value) return undefined;
		return {
			view: value,
			display: toForwardDisplay(value, {
				currentCommunity: chat.community().did,
				channelBySpace: (space) => {
					for (const channel of chat.channels().values()) {
						if (channel.space === space) return channel;
					}
					return undefined;
				},
				threadNameBySpace: chat.threadName,
				threadChannelBySpace: chat.threadChannel,
				communities: chat.communities?.() ?? new Map(),
			}),
			text: toTextValue(value.text, value.facets),
			media: splitAttachments(value.attachments).media,
		};
	});
	const forwardSource = (display: ForwardDisplay) => {
		const source = display.source;
		const target = display.target;
		const open = chat.onOpenForwardSource;
		if (!source || !target || !open) return source;
		return { ...source, onOpen: () => open(target) };
	};
	const resolveReactionEmoji = customReactionResolver(chat.customEmoji);
	const renderReactionEmoji = (emoji: string) => {
		const custom = resolveReactionEmoji(emoji);
		return custom ? (
			<img
				src={custom.src}
				alt=""
				draggable={false}
				class="size-4 object-contain"
			/>
		) : (
			<Emoji emoji={emoji} size={16} />
		);
	};
	const reactions = createMemo(() =>
		toReactions(view()?.reactions, chat.members()),
	);

	const [drawerOpen, setDrawerOpen] = createSignal(false);
	const [drawerMounted, setDrawerMounted] = createSignal(false);
	const [reactorsEmoji, setReactorsEmoji] = createSignal<string>();
	const [reactorsMounted, setReactorsMounted] = createSignal(false);

	const openDrawer = () => {
		setDrawerMounted(true);
		setDrawerOpen(true);
	};

	const openReactors = (emoji: string) => {
		setReactorsMounted(true);
		setReactorsEmoji(emoji);
	};

	const highlight = (): MessageHighlight | undefined => {
		if (drawerOpen()) return "menu";
		if (props.highlight) return props.highlight;
		if (own()) return undefined;
		const viewer = chat.viewer();
		const parent = message().parent;
		if (mentionsDid(message().facets, viewer)) return "mention";
		if (isVisibleParent(parent) && parent.author.did === viewer)
			return "mention";
		return undefined;
	};

	const react = (emoji: string, add: boolean) =>
		chat.onReact(message(), emoji, add);

	const toggleQuick = (emoji: string) => {
		const existing = reactions().find((reaction) => reaction.emoji === emoji);
		react(emoji, !existing?.mine);
	};

	const copy = async () => {
		const copied = await copyText(message().text);
		if (copied) toast.success("Copied text");
		else toast.error("Couldn't copy text");
	};

	const forwardMessage = () => {
		if (chat.onForward) chat.onForward(message());
		else toast.info("Forwarding isn't available yet");
	};

	const thread = () => message().thread;
	const controls = () => chat.controls();
	const now = () => chat.now?.() ?? new Date();

	const hidden = () => {
		const value = view();
		return value ? isHiddenMessage(value) : false;
	};

	const selection = () => chat.selection;
	const selecting = () => selection()?.active() ?? false;
	const selectable = () => sent() && !!message().rkey;
	const movedFrom = () => {
		const value = view();
		return value ? selection()?.movedFrom(value) : undefined;
	};

	const body = () => (
		<>
			<Show when={text().text.length > 0}>
				<RichTextRenderer value={text()} platform={platform()} />
			</Show>
			<Show when={forward()}>
				{(value) => (
					<ForwardedMessage
						time={formatMessageTime(
							value().display.createdAt,
							now(),
							chat.locale,
						)}
						source={forwardSource(value().display)}
					>
						<Show when={value().text.text.length > 0}>
							<RichTextRenderer value={value().text} platform={platform()} />
						</Show>
						<Show when={value().media.length > 0}>
							<MediaWithLightbox
								items={value().media}
								timestamp={value().display.createdAt}
								locale={chat.locale}
							/>
						</Show>
					</ForwardedMessage>
				)}
			</Show>
			<Show when={movedFrom()}>
				{(entry) => (
					<MovedFromLine
						name={entry().name}
						onOpen={selecting() ? undefined : entry().open}
					/>
				)}
			</Show>
		</>
	);

	let seenTarget: HTMLDivElement | undefined;
	createEffect(() => {
		const rkey = message().rkey;
		const observe = chat.observeSeen;
		if (!seenTarget || !rkey || !sent() || !observe) return;
		if (!chat.isUnseen?.(rkey)) return;
		onCleanup(observe(seenTarget, rkey));
	});

	const platform = () => chat.platform?.() ?? "mobile";
	const desktop = () => platform() === "desktop";
	const [menuOpen, setMenuOpen] = createSignal(false);
	const [contextOpen, setContextOpen] = createSignal(false);
	const [pickerAnchor, setPickerAnchor] = createSignal<HTMLElement>();
	const session = mediaSession();

	const openThreadAction = () =>
		thread()
			? () => {
					const value = thread();
					if (value) chat.onOpenThread(value.space);
				}
			: chat.onStartThread && message().state === "sent" && message().rkey
				? () => chat.onStartThread?.(message())
				: undefined;
	const selectAction = () =>
		selection()?.canMove() && selectable()
			? () => {
					const rkey = message().rkey;
					if (rkey) selection()?.begin(rkey);
				}
			: undefined;
	const editAction = () =>
		own() && !anchor() ? () => chat.onEdit(message()) : undefined;
	const deleteAction = () =>
		own() && !anchor() ? () => chat.onDelete(message()) : undefined;
	const [confirmingDelete, setConfirmingDelete] = createSignal(false);
	const confirmDeleteAction = () =>
		own() && !anchor()
			? () => void whenOverlaysClosed().then(() => setConfirmingDelete(true))
			: undefined;
	const replyAction = () =>
		anchor() ? undefined : () => chat.onReply(message());
	const hideAction = () =>
		chat.canModerate?.() && !anchor() && !hidden()
			? () => chat.onSetHidden?.(message(), true)
			: undefined;
	const unhideAction = () =>
		chat.canModerate?.() && !anchor() && hidden()
			? () => chat.onSetHidden?.(message(), false)
			: undefined;

	const menuItems = () => (
		<MessageMenuItems
			onEdit={editAction()}
			onReply={replyAction()}
			onForward={forwardMessage}
			onOpenThread={openThreadAction()}
			onSelect={selectAction()}
			onCopyText={message().text ? copy : undefined}
			onViewReactions={
				reactions().length > 0
					? () => openReactors(reactions()[0]?.emoji ?? "")
					: undefined
			}
			onDelete={confirmDeleteAction()}
			hidden={hidden()}
			onHide={hideAction()}
			onUnhide={unhideAction()}
		/>
	);

	const editingNow = () =>
		desktop() && chat.editingKey?.() === message().key
			? {
					value: text(),
					sources: chat.editSources,
					emoji: { packs: chat.emojiPacks?.() },
					onSave: (value: RichText) => chat.onSaveEdit?.(value),
					onCancel: () => chat.onCancelEdit?.(),
				}
			: undefined;

	const toolbar = () =>
		desktop() && sent() && !selecting() ? (
			<MessageToolbar
				own={own()}
				recentReactions={(
					chat.quickReactions?.() ?? DEFAULT_QUICK_REACTIONS
				).slice(0, 3)}
				renderEmoji={renderReactionEmoji}
				onReact={toggleQuick}
				onAddReaction={(event) =>
					setPickerAnchor(event.currentTarget as HTMLElement)
				}
				onEdit={editAction()}
				onReply={replyAction()}
				onForward={forwardMessage}
				onOpenThread={openThreadAction()}
				onCopyText={message().text ? copy : undefined}
				onSelect={own() ? undefined : selectAction()}
				onHide={own() ? undefined : hideAction()}
				onDelete={deleteAction()}
				menu={menuItems()}
				menuOpen={menuOpen()}
				onMenuOpenChange={setMenuOpen}
			/>
		) : undefined;

	const threadCard = () => (
		<ThreadCard
			name={thread()?.name ?? ""}
			messageCount={thread()?.messageCount ?? 0}
			age={formatAge(thread()?.lastActivityAt ?? "", now())}
			unread={thread()?.viewer.hasUnread}
			mentions={thread()?.viewer.unreadMentions}
			private={thread()?.private}
			onOpen={(event) => {
				const value = thread();
				if (value)
					chat.onOpenThread(value.space, {
						full: desktop() && event.shiftKey,
					});
			}}
			onMenu={
				chat.onThreadMenu && !selecting() && !desktop()
					? () => {
							const value = thread();
							if (value) chat.onThreadMenu?.(value);
						}
					: undefined
			}
		/>
	);

	const row = () => (
		<MessageRow
			platform={platform()}
			author={author()}
			via={viaLabel(profile())}
			timestamp={message().timestamp}
			now={chat.now?.()}
			locale={chat.locale}
			continuation={props.entry().continuation}
			edited={!!view()?.updatedAt}
			reply={reply()}
			highlight={
				desktop() && (menuOpen() || contextOpen()) ? "menu" : highlight()
			}
			state={message().state}
			toolbar={toolbar()}
			toolbarOpen={menuOpen() || !!pickerAnchor()}
			editing={editingNow()}
			onRetry={() => chat.onRetry(message())}
			onDelete={() => chat.onDelete(message())}
			onAuthorClick={() => chat.onOpenProfile(message().author)}
			onAuthorMenu={() => chat.onOpenMemberMenu(message().author)}
			attachments={
				!hidden() && hasAttachmentContent(split(), embeds()) ? (
					<MessageAttachments
						split={split()}
						embeds={embeds()}
						author={author()}
						timestamp={message().timestamp}
						locale={chat.locale}
					/>
				) : undefined
			}
			reactions={
				reactions().length > 0 ? (
					<ReactionBar
						reactions={reactions()}
						renderEmoji={renderReactionEmoji}
						disabled={!sent()}
						onToggle={(emoji, mine) => react(emoji, !mine)}
						onShowReactors={openReactors}
						onAdd={
							desktop()
								? (event?: MouseEvent) => {
										const target = event?.currentTarget;
										if (target instanceof HTMLElement) setPickerAnchor(target);
									}
								: chat.onPickReaction
									? () => chat.onPickReaction?.(message())
									: undefined
						}
					/>
				) : undefined
			}
			thread={
				thread() ? (
					<Show
						when={desktop() && chat.ThreadContextMenu && thread()}
						fallback={threadCard()}
					>
						{(value) => {
							const Menu = chat.ThreadContextMenu as NonNullable<
								typeof chat.ThreadContextMenu
							>;
							return <Menu thread={value()}>{threadCard()}</Menu>;
						}}
					</Show>
				) : undefined
			}
		>
			<Show when={hidden()} fallback={body()}>
				<HiddenMessage reason="moderator">
					{body()}
					<Show when={hasAttachmentContent(split(), embeds())}>
						<MessageAttachments
							split={split()}
							embeds={embeds()}
							author={author()}
							timestamp={message().timestamp}
							locale={chat.locale}
						/>
					</Show>
				</HiddenMessage>
			</Show>
		</MessageRow>
	);

	const mobileRow = () => (
		<SwipeToReply
			enabled={
				!selecting() &&
				!anchor() &&
				sent() &&
				controls().swipeLeftAction === "reply"
			}
			onReply={() => chat.onReply(message())}
		>
			<MessageGestures
				longPress={sent()}
				onLongPress={openDrawer}
				doubleTap={sent() && controls().doubleTapEnabled}
				doubleTapAction={controls().doubleTapAction}
				doubleTapEmoji={controls().doubleTapReactionEmoji}
				canEdit={own() && !anchor()}
				canReply={!anchor()}
				onReact={toggleQuick}
				onEdit={() => chat.onEdit(message())}
				onReply={() => chat.onReply(message())}
			>
				{row()}
			</MessageGestures>
		</SwipeToReply>
	);

	const desktopRow = () => (
		<MessageContextMenu
			disabled={!sent() || !!editingNow()}
			onOpenChange={setContextOpen}
			onEdit={editAction()}
			onReply={replyAction()}
			onForward={forwardMessage}
			onOpenThread={openThreadAction()}
			onSelect={selectAction()}
			onCopyText={message().text ? copy : undefined}
			onViewReactions={
				reactions().length > 0
					? () => openReactors(reactions()[0]?.emoji ?? "")
					: undefined
			}
			onDelete={confirmDeleteAction()}
			hidden={hidden()}
			onHide={hideAction()}
			onUnhide={unhideAction()}
		>
			{row()}
		</MessageContextMenu>
	);

	return (
		<>
			<div ref={seenTarget}>
				<MessageSelectFrame
					selecting={selecting()}
					selected={selection()?.isSelected(message().rkey) ?? false}
					disabled={!selectable()}
					onToggle={(event) => {
						const rkey = message().rkey;
						if (!rkey || !selectable()) return;
						if (event.shiftKey) selection()?.selectRange(rkey);
						else selection()?.toggle(rkey);
					}}
				>
					<Show when={desktop()} fallback={mobileRow()}>
						{desktopRow()}
					</Show>
				</MessageSelectFrame>
			</div>
			<Show when={own()}>
				<ConfirmDialog
					open={confirmingDelete()}
					onOpenChange={setConfirmingDelete}
					title="Delete message?"
					description="This permanently deletes the message. Hold Shift while deleting to skip this confirmation."
					confirmLabel="Delete message"
					tone="destructive"
					onConfirm={() => chat.onDelete(message())}
				/>
			</Show>
			<Show when={pickerAnchor()}>
				{(anchorElement) => (
					<EmojiPickerPopover
						open
						onOpenChange={(open) => {
							if (!open) setPickerAnchor(undefined);
						}}
						anchorElement={anchorElement()}
						placement="bottom-end"
						label="Add a reaction"
						usage={session.usage()}
						skinTone={session.skinTone()}
						onSkinToneChange={session.setSkinTone}
						packs={chat.emojiPacks?.()}
						searchPlaceholder="Search reactions"
						onPick={(pick) => {
							if (pick.kind === "unicode") session.recordEmoji(pick.emoji);
							react(
								pick.kind === "unicode" ? pick.emoji : `:${pick.emoji.name}:`,
								true,
							);
						}}
					/>
				)}
			</Show>
			<Show when={drawerMounted() && !desktop()}>
				<MessageActionsDrawer
					open={drawerOpen()}
					onOpenChange={setDrawerOpen}
					quickReactions={chat.quickReactions?.() ?? DEFAULT_QUICK_REACTIONS}
					onReact={toggleQuick}
					emojiPicker={{ packs: chat.emojiPacks?.() }}
					renderEmoji={renderReactionEmoji}
					onEmojiPick={(pick) =>
						react(
							pick.kind === "unicode" ? pick.emoji : `:${pick.emoji.name}:`,
							true,
						)
					}
					onReply={anchor() ? undefined : () => chat.onReply(message())}
					onEdit={own() && !anchor() ? () => chat.onEdit(message()) : undefined}
					onForward={forwardMessage}
					onOpenThread={
						thread()
							? () => {
									const value = thread();
									if (value) chat.onOpenThread(value.space);
								}
							: chat.onStartThread &&
									message().state === "sent" &&
									message().rkey
								? () => chat.onStartThread?.(message())
								: undefined
					}
					onSelect={
						selection()?.canMove() && selectable()
							? () => {
									const rkey = message().rkey;
									if (rkey) selection()?.begin(rkey);
								}
							: undefined
					}
					onCopyText={message().text ? copy : undefined}
					onDelete={confirmDeleteAction()}
					hidden={hidden()}
					onHide={
						chat.canModerate?.() && !anchor() && !hidden()
							? () => chat.onSetHidden?.(message(), true)
							: undefined
					}
					onUnhide={
						chat.canModerate?.() && !anchor() && hidden()
							? () => chat.onSetHidden?.(message(), false)
							: undefined
					}
				/>
			</Show>
			<Show when={reactorsMounted()}>
				<ReactionsViewer
					platform={platform()}
					open={reactorsEmoji() !== undefined}
					onOpenChange={(open) => {
						if (!open) setReactorsEmoji(undefined);
					}}
					reactions={toReactionGroups(
						view()?.reactions,
						chat.members(),
						chat.viewer(),
						resolveReactionEmoji,
					)}
					active={reactorsEmoji()}
					onActiveChange={setReactorsEmoji}
					onRemove={(emoji) => react(emoji, false)}
					onOpenProfile={(reactor) => {
						setReactorsEmoji(undefined);
						chat.onOpenProfile(reactor.id);
					}}
				/>
			</Show>
		</>
	);
};
