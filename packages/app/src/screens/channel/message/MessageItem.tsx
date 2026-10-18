import {
	ConfirmDialog,
	copyMessageToClipboard,
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
	type MessageMenuImage,
	MessageMenuItems,
	type MessageMenuLink,
	type MessageReply,
	MessageRow,
	MessageSelectFrame,
	MessageToolbar,
	MovedFromLine,
	pdslsHrefFor,
	ReactionBar,
	ReactionsViewer,
	type RichText,
	RichTextRenderer,
	SwipeToReply,
	ThreadCard,
	toast,
	useShiftHeld,
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
	embedSuppression,
	gifOfAttachments,
	inlineMediaOf,
	isEmbedSuppressed,
	splitAttachments,
	visibleEmbeds,
} from "../../../data/adapters/attachments";
import {
	type AuthorDirectory,
	toMessageAuthor,
	viaLabel,
} from "../../../data/adapters/authors";
import { parseBlueskyPostUrl } from "../../../data/adapters/bluesky-post";
import {
	linkUris,
	mentionsDid,
	mentionsRole,
	previewText,
	spoileredLinkUris,
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
import { openExternalUrl } from "../../../native/open-external";
import { PrimaryBadge } from "../../profile/user-badges";
import { mediaSession } from "../composer/media/session";
import { whenOverlaysClosed } from "../forward/overlay-wait";
import { type EmbedEditor, useChat } from "./chat-context";
import {
	copyImage,
	downloadImage,
	type ImageTarget,
	imageTargetOf,
} from "./image-actions";
import { LinkPreviewsDialog } from "./link-previews";
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

export const HIDE_CONFIRM_COPY = {
	title: "Hide message?",
	description:
		"Members won't see this message anymore. You and other moderators can still see and unhide it. Hold Shift while hiding to skip this confirmation.",
	confirm: "Hide message",
} as const;

export const DELETE_CONFIRM_COPY = {
	title: "Delete message?",
	description:
		"This permanently deletes the message. Hold Shift while deleting to skip this confirmation.",
	confirm: "Delete message",
} as const;

const isWebLink = (href: string) => /^https?:\/\//i.test(href);

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
	const bridged = () => !!profile().bridge;
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
	const suppression = createMemo(() => embedSuppression(view()));
	const embedsOn = () => chat.linkEmbedsEnabled?.() !== false;
	const spoileredLinks = createMemo(() => spoileredLinkUris(message().facets));
	const unspoileredEmbeds = () =>
		(view()?.embeds ?? []).filter((embed) => !spoileredLinks().has(embed.uri));
	const embeds = createMemo(() =>
		embedsOn() ? visibleEmbeds(unspoileredEmbeds(), suppression()) : [],
	);
	const blueskyLinks = createMemo(() => {
		if (!chat.loadBlueskyPost || !embedsOn()) return [];
		const covered = new Set<string>(
			unspoileredEmbeds().map((embed) => embed.uri),
		);
		return linkUris(message().facets).filter(
			(uri) =>
				!covered.has(uri) &&
				!!parseBlueskyPostUrl(uri) &&
				!isEmbedSuppressed(suppression(), uri),
		);
	});
	const embedUris = createMemo(() => {
		const uris: string[] = [];
		const add = (uri: string) => {
			if (!uris.includes(uri)) uris.push(uri);
		};
		for (const embed of unspoileredEmbeds()) add(embed.uri);
		for (const uri of linkUris(message().facets)) {
			if (parseBlueskyPostUrl(uri)) add(uri);
		}
		for (const uri of [...suppression().author, ...suppression().moderator]) {
			if (!spoileredLinks().has(uri)) add(uri);
		}
		return uris;
	});
	const loneMediaLink = createMemo(() => {
		if (view()?.forward) return false;
		const links = linkUris(message().facets);
		if (links.length !== 1 || message().text.trim() !== links[0]) return false;
		const embed = embeds().find((entry) => entry.uri === links[0]);
		return !!embed && !!inlineMediaOf(embed);
	});
	const attachmentContent = () =>
		hasAttachmentContent(split(), embeds(), blueskyLinks());
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
	const reactionEmojiAt = (size: number) => (emoji: string) => {
		const custom = resolveReactionEmoji(emoji);
		return custom ? (
			<img
				src={custom.src}
				alt=""
				draggable={false}
				class="object-contain"
				style={{ width: `${size}px`, height: `${size}px` }}
			/>
		) : (
			<Emoji emoji={emoji} size={size} />
		);
	};
	const renderReactionEmoji = reactionEmojiAt(16);
	const renderToolbarEmoji = reactionEmojiAt(18);
	const renderQuickReactionEmoji = reactionEmojiAt(24);
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
		if (mentionsRole(message().facets, chat.viewerRoles?.() ?? []))
			return "mention";
		if (isVisibleParent(parent) && parent.author.did === viewer)
			return "mention";
		return undefined;
	};

	const react = (emoji: string, add: boolean) => {
		if (add && !emoji.startsWith(":")) chat.onRecordEmoji?.(emoji);
		chat.onReact(message(), emoji, add);
	};

	const toggleQuick = (emoji: string) => {
		const existing = reactions().find((reaction) => reaction.emoji === emoji);
		react(emoji, !existing?.mine);
	};

	const copy = async () => {
		const copied = await copyMessageToClipboard(
			message().text,
			message().facets as Parameters<typeof copyMessageToClipboard>[1],
		);
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
			<Show when={text().text.length > 0 && !loneMediaLink()}>
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
	const shiftHeld = useShiftHeld();
	const editAction = () =>
		own() && !anchor() ? () => chat.onEdit(message()) : undefined;
	const deleteAction = () =>
		own() && !anchor() ? () => chat.onDelete(message()) : undefined;
	const [confirmingDelete, setConfirmingDelete] = createSignal(false);
	const confirmDeleteAction = () =>
		own() && !anchor()
			? () => {
					if (desktop() && shiftHeld()) {
						chat.onDelete(message());
						return;
					}
					void whenOverlaysClosed().then(() => setConfirmingDelete(true));
				}
			: undefined;
	const canReply = () => !anchor() && chat.canPost?.() !== false;
	const replyAction = () =>
		canReply() ? () => chat.onReply(message()) : undefined;
	const canModerate = () => !!chat.canModerate?.() && !anchor();
	const hideAction = () =>
		canModerate() && !hidden()
			? () => chat.onSetHidden?.(message(), true)
			: undefined;
	const [confirmingHide, setConfirmingHide] = createSignal(false);
	const confirmHideAction = () =>
		canModerate() && !hidden()
			? () => {
					if (desktop() && shiftHeld()) {
						chat.onSetHidden?.(message(), true);
						return;
					}
					void whenOverlaysClosed().then(() => setConfirmingHide(true));
				}
			: undefined;
	const unhideAction = () =>
		canModerate() && hidden()
			? () => chat.onSetHidden?.(message(), false)
			: undefined;

	const [contextLink, setContextLink] = createSignal<HTMLAnchorElement>();
	const [contextImage, setContextImage] = createSignal<ImageTarget>();
	const [contextSelection, setContextSelection] = createSignal<{
		text: string;
		ranges: Range[];
	}>();
	const captureSelection = (row: Element) => {
		const current = window.getSelection();
		if (!current || current.isCollapsed) return undefined;
		const ranges = Array.from({ length: current.rangeCount }, (_, index) =>
			current.getRangeAt(index).cloneRange(),
		);
		if (!ranges.some((range) => range.intersectsNode(row))) return undefined;
		const text = current.toString();
		return text.trim() ? { text, ranges } : undefined;
	};
	const restoreSelection = () => {
		const saved = contextSelection();
		const current = window.getSelection();
		if (!saved || !current?.isCollapsed) return;
		current.removeAllRanges();
		for (const range of saved.ranges) current.addRange(range);
	};
	const copySelectionAction = () => {
		const saved = contextSelection();
		if (!saved) return undefined;
		return async () => {
			const copied = await copyText(saved.text);
			if (copied) toast.success("Copied text");
			else toast.error("Couldn't copy text");
		};
	};
	let pressedSelection:
		| { value: ReturnType<typeof captureSelection> }
		| undefined;
	const captureSecondaryPress = (event: MouseEvent) => {
		const secondary =
			event.button === 2 || (event.button === 0 && event.ctrlKey);
		if (!secondary || !(event.currentTarget instanceof Element)) return;
		pressedSelection = { value: captureSelection(event.currentTarget) };
	};
	const captureContextLink = (event: MouseEvent) => {
		if (event.currentTarget instanceof Element) {
			setContextSelection(
				pressedSelection
					? pressedSelection.value
					: captureSelection(event.currentTarget),
			);
		}
		pressedSelection = undefined;
		const target = event.target;
		const anchorElement =
			target instanceof Element
				? target.closest<HTMLAnchorElement>("a[href]")
				: null;
		setContextLink(anchorElement ?? undefined);
		setContextImage(imageTargetOf(target instanceof Element ? target : null));
	};
	const capturePressedImage = (event: PointerEvent) => {
		if (event.pointerType === "mouse") return;
		const target = event.target;
		setContextImage(imageTargetOf(target instanceof Element ? target : null));
	};
	const attachRow = (element: HTMLDivElement) => {
		seenTarget = element;
		element.addEventListener("mousedown", captureSecondaryPress, true);
		element.addEventListener("contextmenu", captureContextLink, true);
		element.addEventListener("pointerdown", capturePressedImage, {
			capture: true,
			passive: true,
		});
	};
	const imageActions = (): MessageMenuImage | undefined => {
		const target = contextImage();
		if (!target) return undefined;
		return {
			onCopy: () => void copyImage(target),
			onDownload: () => void downloadImage(target),
		};
	};
	const openLink = (anchorElement: HTMLAnchorElement) => {
		const href = anchorElement.href;
		if (isWebLink(href) && chat.onExternalLink) {
			chat.onExternalLink(href, {
				label: anchorElement.textContent?.trim() || href,
				disguised: anchorElement.dataset.disguised !== undefined,
			});
			return;
		}
		anchorElement.click();
	};
	const linkActions = (): MessageMenuLink | undefined => {
		const anchorElement = contextLink();
		if (!anchorElement) return undefined;
		return {
			onOpen: () => openLink(anchorElement),
			onCopy: async () => {
				const copied = await copyText(anchorElement.href);
				if (copied) toast.success("Copied link");
				else toast.error("Couldn't copy link");
			},
		};
	};

	const gif = createMemo(() => {
		const value = gifOfAttachments(view()?.attachments);
		if (!value || !chat.onToggleGif) return undefined;
		return value;
	});
	const gifAction = () => {
		const value = gif();
		if (!value) return undefined;
		const saved = chat.gifSaved?.(value) ?? false;
		return {
			saved,
			onToggle: () => chat.onToggleGif?.(value, !saved),
		};
	};

	const embedEditor = (): EmbedEditor | undefined => {
		if (!sent() || anchor() || !message().rkey || !chat.onSetEmbeds) {
			return undefined;
		}
		if (own()) return "author";
		return chat.canModerate?.() ? "moderator" : undefined;
	};
	const hiddenByMe = () =>
		embedEditor() === "author"
			? [...suppression().author]
			: [...suppression().moderator];
	const embedLockedBy = (uri: string) => {
		if (embedEditor() === "author") {
			return suppression().moderator.includes(uri) ? "moderator" : undefined;
		}
		return suppression().author.includes(uri) ? "author" : undefined;
	};
	const [previewsOpen, setPreviewsOpen] = createSignal(false);
	const [previewsMounted, setPreviewsMounted] = createSignal(false);
	const [previewSeed, setPreviewSeed] = createSignal<string[]>([]);
	const saveEmbeds = (uris: string[]) => {
		const editor = embedEditor();
		if (!editor) return Promise.resolve();
		return chat.onSetEmbeds?.(message(), uris, editor) ?? Promise.resolve();
	};
	const openPreviews = (seed?: string) => {
		const base = hiddenByMe();
		setPreviewSeed(seed && !base.includes(seed) ? [...base, seed] : base);
		setPreviewsMounted(true);
		void whenOverlaysClosed().then(() => setPreviewsOpen(true));
	};
	const linkPreviewsAction = () =>
		embedEditor() && embedUris().length > 0 ? () => openPreviews() : undefined;
	const removeEmbed = () =>
		embedEditor()
			? (uri: string, event: MouseEvent) => {
					if (event.shiftKey) {
						const base = hiddenByMe();
						if (!base.includes(uri)) void saveEmbeds([...base, uri]);
						return;
					}
					openPreviews(uri);
				}
			: undefined;

	const developer = () => {
		const uri = view()?.uri;
		if (!uri || !chat.developerMode?.()) return undefined;
		return {
			atUri: uri,
			pdslsHref: pdslsHrefFor(uri),
		};
	};
	const copyAtUri = () => {
		const uri = developer()?.atUri;
		if (!uri) return;
		void copyText(uri).then((copied) => {
			if (copied) toast.success("AT-URI copied");
		});
	};
	const showOnPdsls = () => {
		const href = developer()?.pdslsHref;
		if (href) openExternalUrl(href);
	};
	const viewReactionsAction = () =>
		reactions().length > 0
			? () => openReactors(reactions()[0]?.emoji ?? "")
			: undefined;
	const drawerReactionsAction = () => {
		const first = reactions()[0]?.emoji;
		if (first === undefined) return undefined;
		return () => {
			setReactorsMounted(true);
			void whenOverlaysClosed().then(() => setReactorsEmoji(first));
		};
	};

	const menuItems = () => (
		<MessageMenuItems
			onEdit={editAction()}
			onReply={replyAction()}
			onForward={forwardMessage}
			onOpenThread={openThreadAction()}
			onSelect={selectAction()}
			onCopyText={message().text ? copy : undefined}
			image={imageActions()}
			gif={gifAction()}
			onLinkPreviews={linkPreviewsAction()}
			onViewReactions={viewReactionsAction()}
			developerMode={!!developer()}
			onCopyAtUri={copyAtUri}
			onShowOnPdsls={showOnPdsls}
			onDelete={confirmDeleteAction()}
			hidden={hidden()}
			onHide={confirmHideAction()}
			onUnhide={unhideAction()}
		/>
	);

	const editingNow = () =>
		desktop() && chat.editingKey?.() === message().key
			? {
					value: chat.editDraft?.() ?? text(),
					baseline: text(),
					onChange: (value: RichText) => chat.onEditChange?.(value),
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
				renderEmoji={renderToolbarEmoji}
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

	const attachmentsView = () => (
		<MessageAttachments
			split={split()}
			embeds={embeds()}
			blueskyLinks={blueskyLinks()}
			loadBlueskyPost={chat.loadBlueskyPost}
			onRemoveEmbed={removeEmbed()}
			author={author()}
			timestamp={message().timestamp}
			locale={chat.locale}
			onExternalLink={chat.onExternalLink}
		/>
	);

	const row = () => (
		<MessageRow
			platform={platform()}
			author={author()}
			badge={bridged() ? undefined : <PrimaryBadge profile={profile()} />}
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
			onAuthorClick={
				bridged() ? undefined : () => chat.onOpenProfile(message().author)
			}
			onAuthorMenu={
				bridged() || desktop()
					? undefined
					: () => chat.onOpenMemberMenu(message().author)
			}
			wrapAuthor={
				!bridged() && desktop() && chat.memberContextMenu
					? (trigger, wrapperClass) =>
							chat.memberContextMenu?.(message().author, trigger, wrapperClass)
					: undefined
			}
			attachments={
				!hidden() && attachmentContent() ? attachmentsView() : undefined
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
					<Show when={attachmentContent()}>{attachmentsView()}</Show>
				</HiddenMessage>
			</Show>
		</MessageRow>
	);

	const mobileRow = () => (
		<SwipeToReply
			enabled={
				!selecting() &&
				canReply() &&
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
				canReply={canReply()}
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
			onOpenChange={(open) => {
				setContextOpen(open);
				if (!open) {
					setContextLink(undefined);
					setContextImage(undefined);
				}
				requestAnimationFrame(() => {
					restoreSelection();
					if (!open) setContextSelection(undefined);
				});
			}}
			onCopySelection={copySelectionAction()}
			link={linkActions()}
			image={imageActions()}
			onEdit={editAction()}
			onReply={replyAction()}
			onForward={forwardMessage}
			onOpenThread={openThreadAction()}
			onSelect={selectAction()}
			onCopyText={message().text ? copy : undefined}
			gif={gifAction()}
			onLinkPreviews={linkPreviewsAction()}
			onViewReactions={viewReactionsAction()}
			developerMode={!!developer()}
			onCopyAtUri={copyAtUri}
			onShowOnPdsls={showOnPdsls}
			onDelete={confirmDeleteAction()}
			hidden={hidden()}
			onHide={confirmHideAction()}
			onUnhide={unhideAction()}
		>
			{row()}
		</MessageContextMenu>
	);

	return (
		<>
			<div ref={attachRow}>
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
					title={DELETE_CONFIRM_COPY.title}
					description={DELETE_CONFIRM_COPY.description}
					confirmLabel={DELETE_CONFIRM_COPY.confirm}
					tone="destructive"
					onConfirm={() => chat.onDelete(message())}
				/>
			</Show>
			<Show when={canModerate()}>
				<ConfirmDialog
					open={confirmingHide()}
					onOpenChange={setConfirmingHide}
					title={HIDE_CONFIRM_COPY.title}
					description={HIDE_CONFIRM_COPY.description}
					confirmLabel={HIDE_CONFIRM_COPY.confirm}
					tone="destructive"
					onConfirm={() => chat.onSetHidden?.(message(), true)}
				/>
			</Show>
			<Show when={previewsMounted()}>
				<LinkPreviewsDialog
					open={previewsOpen()}
					onOpenChange={setPreviewsOpen}
					platform={platform()}
					uris={embedUris()}
					hidden={previewSeed()}
					lockedBy={embedLockedBy}
					enabled={embedsOn()}
					moderator={embedEditor() === "moderator"}
					onSave={saveEmbeds}
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
					renderEmoji={renderQuickReactionEmoji}
					onEmojiPick={(pick) =>
						react(
							pick.kind === "unicode" ? pick.emoji : `:${pick.emoji.name}:`,
							true,
						)
					}
					onReply={replyAction()}
					onEdit={editAction()}
					onForward={forwardMessage}
					onOpenThread={openThreadAction()}
					onSelect={selectAction()}
					onCopyText={message().text ? copy : undefined}
					image={imageActions()}
					gif={gifAction()}
					onLinkPreviews={linkPreviewsAction()}
					onViewReactions={drawerReactionsAction()}
					onDelete={confirmDeleteAction()}
					hidden={hidden()}
					onHide={confirmHideAction()}
					onUnhide={unhideAction()}
					developer={developer()}
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
