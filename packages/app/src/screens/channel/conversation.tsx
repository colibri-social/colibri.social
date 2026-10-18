import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	Button,
	COMPOSER_TYPING_INSET,
	Composer,
	ComposerBar,
	ConfirmDialog,
	MessageList,
	type MessageListHandle,
	ReplyBar,
	type RichEditorHandle,
	type RichEditorSources,
	type RichText,
	StatusScreen,
	TypingIndicator,
	toast,
	topEmoji,
} from "@colibri-social/ui";
import { ArchiveDownMinimalisticIcon } from "@solar-icons/solid/bold/archive-down-minimalistic";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import {
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	on,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import { authorForDid, displayNameOf } from "../../data/adapters/authors";
import { fromComposerValue, toTextValue } from "../../data/adapters/facets";
import { reactionFor, reactionShortcode } from "../../data/adapters/reactions";
import { channelSlug, skeyOf, spaceKey } from "../../data/ids";
import {
	createMediaLinkRefresher,
	MediaLinkContext,
} from "../../data/media-link";
import {
	createComposerDraft,
	editDraftKey,
	readEditDraft,
	writeEditDraft,
} from "../../data/persist-drafts";
import { isMentionableRole } from "../../data/role-flags";
import { type ChannelData, useData } from "../../data/store";
import type {
	AttachmentView,
	BlueskyPostView,
	ChannelView,
	Did,
	GifView,
	MemberView,
	MessageView,
	ReactionEmojiRef,
	RoleView,
	SpaceRef,
	ThreadView,
} from "../../data/types";
import { appVisible } from "../../data/visibility";
import { usePlatform } from "../../screen/platform";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import { isCovered } from "../../shell/desktop/desktop-route";
import { useStack } from "../../shell/stack";
import { uiPresence } from "../members/member-adapter";
import { useMemberMenu } from "../members/member-menu";
import { useProfileSheet } from "../profile/profile-sheet";
import { createThreadMenu } from "../threads/thread-menu";
import { suppressedLinksFor } from "./composer/link-previews";
import {
	createComposerMedia,
	createReactionPicker,
	gifAttachment,
} from "./composer/media";
import { createMediaSession } from "./composer/media/session";
import { createAttachmentDraft } from "./composer/uploads/attachment-draft";
import { createForwardPicker } from "./forward/ForwardPicker";
import {
	ChatContextProvider,
	type ChatContextValue,
	ChatRichTextProvider,
} from "./message/chat-context";
import { createCustomEmojiDrawer } from "./message/custom-emoji-drawer";
import { createLinkOpener } from "./message/link-opener";
import { DELETE_CONFIRM_COPY, MessageItem } from "./message/MessageItem";
import {
	type ChatMessage,
	failChatMessage,
	isHiddenMessage,
	pendingChatMessage,
	toChatMessage,
} from "./message/types";
import { createMessageSelection } from "./selection/selection";
import { indexThreadAnchors, threadAnchorKey } from "./thread-anchors";

export type ConversationOptions = {
	space: string;
	channel: string;
	target: () => SpaceRef | undefined;
	label: () => string;
	isActive: () => boolean;
	thread?: () => ThreadView | undefined;
};

const JUMP_FRAMES = 12;

export const DELETED_PING_COPY = "The message that pinged you was deleted.";
export const CLOSED_THREAD_COPY =
	"This thread is closed. Sending a message reopens it.";
export const LOCKED_THREAD_COPY =
	"This thread is locked. Only moderators can post here.";
const QUICK_REACTION_COUNT = 4;

const log = createLogger("conversation");

const blueskyPosts = new Map<string, Promise<BlueskyPostView | undefined>>();
const SEEN_RATIO = 0.6;
const SEEN_THRESHOLDS = [0, 0.25, 0.5, SEEN_RATIO, 0.8, 1];

export const laterRound = (label: string) => () =>
	toast.info(`${label} arrives in a later round`);

export const createConversation = (options: ConversationOptions) => {
	const data = useData();
	const session = createMediaSession(data.preferences);
	const stack = useStack();
	const platform = usePlatform();
	const desktop = () => platform() === "desktop";
	const shell = useOptionalDesktopShell();
	const modalOpen = () => (shell ? isCovered(shell.stack.route()) : false);
	let mediaAnchor: HTMLElement | undefined;
	const profileSheet = useProfileSheet();
	const memberMenu = useMemberMenu();
	const links = createLinkOpener();
	const attachments = createAttachmentDraft();
	let editor: RichEditorHandle | undefined;
	const keepEditorFocus = (frames = 12) => {
		const element = editor?.element();
		if (!element || frames <= 0) return;
		if (!element.contains(document.activeElement)) editor?.focus();
		requestAnimationFrame(() => keepEditorFocus(frames - 1));
	};
	const emojiPacks = () => data.emoji.packs(community()?.did);
	const emojiDrawer = createCustomEmojiDrawer({
		data,
		community: () => community()?.did,
	});
	const media = createComposerMedia({
		get platform() {
			return platform();
		},
		anchor: () => mediaAnchor,
		focusComposer: () => editor?.focus(),
		gifs: data.source,
		packs: emojiPacks,
		onInsertEmoji: (emoji) => {
			editor?.insertText(emoji);
			keepEditorFocus();
		},
		onInsertCustomEmoji: (picked) => {
			const emoji = data.emoji.lookup(picked.id);
			editor?.insertCustomEmoji(
				emoji
					? data.emoji.suggestion(emoji)
					: { id: picked.id, name: picked.name, src: picked.src },
			);
			keepEditorFocus();
		},
		onSendGif: (gif) => {
			const current = feed();
			if (!current) return;
			pinWhile(
				() =>
					void current.send({ text: "", attachments: [gifAttachment(gif)] }),
			);
		},
	});
	const reactionPicker = createReactionPicker({ packs: emojiPacks });
	const forwardPicker = createForwardPicker({
		onOpenChannel: (space, channel, channelType) => {
			if (space !== options.space) stack.setRoot({ tab: "spaces", space });
			stack.replaceTop({ kind: "chat", space, channel, channelType });
		},
	});
	const community = createMemo(() => data.spaceByKey(options.space));
	const space = createMemo(() => {
		const current = community();
		return current ? data.space(current) : undefined;
	});
	const view = createMemo(() => space()?.channelBySlug(options.channel));
	const writable = () =>
		(options.thread?.() ?? view())?.viewer.canPost !== false;
	const unavailable = createMemo<"space" | "channel" | "thread" | undefined>(
		() => {
			if (data.communities.loading()) return undefined;
			const current = space();
			if (!current) return "space";
			if (current.channels.loading() || current.channels.error()) {
				return undefined;
			}
			return view() ? undefined : "channel";
		},
	);
	const feed = createMemo(() => {
		const ref = options.target();
		return ref ? data.channel(ref) : undefined;
	});
	createEffect(() => {
		const ref = options.target();
		if (ref) onCleanup(data.holdChannel(ref));
	});
	const [replyTo, setReplyTo] = createSignal<ChatMessage>();
	const [editing, setEditing] = createSignal<ChatMessage>();
	const muted = () => {
		const ref = options.target();
		return ref ? data.isMuted(ref) : false;
	};
	const setMuted = (next: boolean) => {
		const ref = options.target();
		if (ref) data.setMuted(ref, next);
	};
	let list: MessageListHandle | undefined;
	const pinWhile = (insert: () => void) => {
		list?.scrollToBottom({ smooth: false });
		insert();
		list?.scrollToBottom({ smooth: false });
	};
	const [deletedPing, setDeletedPing] = createSignal(false);
	const [jumping, setJumping] = createSignal(0);
	const handledOrphans = new Set<string>();
	createEffect(
		on(options.target, () => {
			setDeletedPing(false);
			handledOrphans.clear();
		}),
	);
	const confirmOrphans = async (
		ref: SpaceRef,
		current: ChannelData,
		orphans: readonly { id: string; message?: { rkey: string } }[],
	) => {
		const missing: string[] = [];
		for (const entry of orphans) {
			const rkey = entry.message?.rkey;
			if (!rkey) continue;
			try {
				if (!(await current.loadAround(rkey))) missing.push(entry.id);
			} catch (thrown) {
				handledOrphans.delete(entry.id);
				log.warn("checking a pinged message failed", {
					code: classifyThrown(thrown, { method: "channel.listMessages" }).code,
				});
			}
		}
		if (missing.length === 0 || options.target() !== ref) return;
		setDeletedPing(true);
		void data.notifications.markRead(missing).catch(() => {});
	};

	createEffect(() => {
		const ref = options.target();
		const current = feed();
		if (!ref || !current?.ready() || !current.confirmed()) return;
		if (current.hasNewer() || current.loadingOlder() || current.loadingNewer())
			return;
		if (jumping() > 0 || data.jumps.pending()?.channel === ref) return;
		const messages = current.messages();
		const oldest = messages[0]?.rkey;
		const newest = messages.at(-1)?.rkey;
		if (!newest) return;
		const present = new Set(messages.map((message) => message.rkey));
		const complete = !current.hasOlder();
		const orphans = data.notifications.items().filter((entry) => {
			const rkey = entry.message?.rkey;
			if (!rkey || entry.seenAt || handledOrphans.has(entry.id)) return false;
			if ((entry.thread ?? entry.channel) !== ref) return false;
			if (present.has(rkey) || rkey > newest) return false;
			return complete || (!!oldest && rkey > oldest);
		});
		if (orphans.length === 0) return;
		for (const entry of orphans) handledOrphans.add(entry.id);
		untrack(() => void confirmOrphans(ref, current, orphans));
	});

	const isActive = options.isActive;

	let entered: ChannelData | undefined;
	let ownDepth = 0;
	let covered = false;
	let leftForFullThread = false;
	const [activeFeed, setActiveFeed] = createSignal<ChannelData>();
	createEffect(() => {
		const current = feed();
		if (!current || !isActive()) return;
		const returning = leftForFullThread && entered === current;
		const fresh = entered !== current || returning;
		leftForFullThread = false;
		entered = current;
		ownDepth = untrack(stack.activeDepth);
		const firstUnread = untrack(() => current.enter(fresh));
		if (
			firstUnread &&
			(returning || (!fresh && (!covered || list?.isAtBottom())))
		) {
			const key = data.nonceFor(firstUnread) ?? firstUnread;
			requestAnimationFrame(() =>
				list?.jumpTo(key, { align: "start", smooth: false, highlight: false }),
			);
		}
		onCleanup(() => {
			covered = untrack(stack.activeDepth) > ownDepth;
			const top = untrack(stack.mounted).at(-1);
			leftForFullThread = top?.kind === "thread" && top.presentation === "full";
		});
		data.setViewing(current.channel);
		if (options.space && options.channel) {
			data.setLastChannel(options.space, options.channel);
		}
		current.markRead();
		setActiveFeed(current);
		onCleanup(() => {
			setActiveFeed(undefined);
			data.setViewing(undefined);
		});
	});

	const memberMap = createMemo(
		() =>
			new Map<string, MemberView>(
				(space()?.members.value() ?? []).map((member) => [
					member.actor.did,
					member,
				]),
			),
	);
	const roleMap = createMemo(
		() =>
			new Map<string, RoleView>(
				(space()?.roles.value() ?? []).map((role) => [role.rkey, role]),
			),
	);
	const channelMap = createMemo(
		() =>
			new Map<string, ChannelView>(
				(space()?.channels.value() ?? []).map((entry) => [
					channelSlug(entry),
					entry,
				]),
			),
	);
	const threadsByAnchor = createMemo(() =>
		indexThreadAnchors(feed()?.threads.value() ?? [], options.target()),
	);
	const threadsByAnchorRkey = createMemo(() => {
		const map = new Map<string, ThreadView>();
		for (const thread of threadsByAnchor().values()) {
			const rkey = thread.anchor?.rkey;
			if (rkey && !map.has(rkey)) map.set(rkey, thread);
		}
		return map;
	});

	const [revealed, setRevealed] = createSignal(
		untrack(() => {
			const current = feed();
			return !!current?.ready() && current.messages().length > 0;
		}),
	);
	createEffect(() => {
		if (revealed() || !feed()?.ready() || stack.moving()) return;
		const frame = requestAnimationFrame(() =>
			requestAnimationFrame(() => setRevealed(true)),
		);
		onCleanup(() => cancelAnimationFrame(frame));
	});

	const [atBottom, setAtBottom] = createSignal(false);
	createEffect(() => {
		const current = feed();
		if (
			!isActive() ||
			!atBottom() ||
			!revealed() ||
			activeFeed() !== current ||
			modalOpen() ||
			!appVisible() ||
			!current?.ready()
		)
			return;
		if (current.messages().length === 0) return;
		untrack(() => current.markRead());
	});

	const nextFrame = () =>
		new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);

	const jumpWhenLoaded = async (rkey: string) => {
		setJumping((count) => count + 1);
		try {
			await jumpTo(rkey);
		} finally {
			setJumping((count) => count - 1);
		}
	};

	const jumpTo = async (rkey: string) => {
		await nextFrame();
		if (list?.jumpTo(keyFor(rkey))) return;
		const current = feed();
		if (!current) return;
		let found: boolean;
		try {
			found = await current.loadAround(rkey);
		} catch (thrown) {
			log.warn("jumping to a message failed", {
				code: classifyThrown(thrown, { method: "channel.listMessages" }).code,
			});
			toast.error(
				"Couldn't open that message. Check your connection and try again.",
			);
			return;
		}
		if (!found) {
			setDeletedPing(true);
			return;
		}
		for (let attempt = 0; attempt < JUMP_FRAMES; attempt++) {
			await nextFrame();
			if (list?.jumpTo(keyFor(rkey))) return;
		}
		toast.info("That message is not loaded");
	};

	createEffect(() => {
		const ref = options.target();
		const request = data.jumps.pending();
		if (!ref || !revealed() || request?.channel !== ref) return;
		const rkey = data.jumps.take(ref);
		if (rkey && !list?.jumpTo(keyFor(rkey))) void jumpWhenLoaded(rkey);
	});

	const canStartThread = () => {
		const ref = options.target();
		if (!ref || ref.includes("/social.colibri.beta.channel.thread/")) {
			return false;
		}
		const viewer = community()?.viewer;
		return (
			!!viewer?.isOwner || !!viewer?.permissions?.includes("thread.create")
		);
	};

	const startThread = (message: ChatMessage) => {
		if (!message.rkey || message.state !== "sent") return;
		stack.push({
			kind: "threadDraft",
			space: options.space,
			channel: options.channel,
			anchor: message.rkey,
		});
	};

	const canModerate = () => {
		const viewer = community()?.viewer;
		return !!viewer?.isOwner || !!viewer?.permissions?.includes("label.apply");
	};

	const cache = new WeakMap<MessageView, ChatMessage>();
	const items = createMemo<ChatMessage[]>(() => {
		const current = feed();
		if (!current || !revealed()) return [];
		const threads = threadsByAnchor();
		const moderator = canModerate();
		const viewerDid = data.viewer.did;
		const sent = current
			.messages()
			.filter(
				(message) =>
					moderator ||
					message.author.did === viewerDid ||
					!isHiddenMessage(message),
			)
			.map((message) => {
				const thread = threads.get(
					threadAnchorKey(message.author.did, message.rkey),
				);
				const key = data.nonceFor(message.rkey);
				const cached = cache.get(message);
				if (
					cached &&
					cached.thread === thread &&
					cached.key === (key ?? message.rkey)
				)
					return cached;
				const next = toChatMessage(message, { key, thread });
				cache.set(message, next);
				return next;
			});
		const viewer = data.viewer.did;
		const pending = current.pending().map((entry) => {
			const parent = entry.parent
				? current.messages().find((message) => message.rkey === entry.parent)
				: undefined;
			const message = pendingChatMessage({
				nonce: entry.nonce,
				author: viewer,
				text: entry.text,
				facets: entry.facets,
				parent,
				createdAt: entry.createdAt,
				attachments: [
					...(entry.attachments ?? []),
					...(entry.uploads ?? []).map((upload) => ({
						url: (upload.previewSrc ?? "") as AttachmentView["url"],
						mimeType: upload.file.type || "application/octet-stream",
						name: upload.file.name,
						size: upload.file.size,
						...(upload.spoiler ? { spoiler: true } : {}),
						...(upload.alt ? { alt: upload.alt } : {}),
					})),
				],
				uploadProgress: entry.uploads?.map((upload) =>
					upload.failed ? undefined : upload.progress,
				),
			});
			return entry.state === "failed" ? failChatMessage(message) : message;
		});
		return [...sent, ...pending];
	});

	const directory = () => ({ members: memberMap(), roles: roleMap() });
	const nameOf = (did: string) => {
		const member = memberMap().get(did);
		return member
			? displayNameOf(member.actor, member)
			: did === data.viewer.did
				? displayNameOf(data.viewer)
				: "Someone";
	};

	const keyFor = (rkey: string) => data.nonceFor(rkey) ?? rkey;

	const unseen = createMemo(() => {
		const ref = options.target();
		const byMessage = new Map<string, string[]>();
		if (!ref) return byMessage;
		for (const entry of data.notifications.items()) {
			if (entry.seenAt || !entry.message) continue;
			if ((entry.thread ?? entry.channel) !== ref) continue;
			const ids = byMessage.get(entry.message.rkey);
			if (ids) ids.push(entry.id);
			else byMessage.set(entry.message.rkey, [entry.id]);
		}
		return byMessage;
	});
	const visibleMessages = new Set<string>();
	const seenTargets = new Map<Element, string>();
	let seenObserver: IntersectionObserver | undefined;
	const canSee = () =>
		isActive() && !modalOpen() && !stack.moving() && appVisible();
	const flushSeen = () => {
		if (visibleMessages.size === 0 || !untrack(canSee)) return;
		const byMessage = untrack(unseen);
		const ids = [...visibleMessages].flatMap(
			(rkey) => byMessage.get(rkey) ?? [],
		);
		if (ids.length > 0) void data.notifications.markRead(ids).catch(() => {});
	};
	const onSeenEntries = (entries: IntersectionObserverEntry[]) => {
		for (const entry of entries) {
			const rkey = seenTargets.get(entry.target);
			if (!rkey) continue;
			const viewport = entry.rootBounds?.height ?? window.innerHeight;
			const seen =
				entry.isIntersecting &&
				(entry.intersectionRatio >= SEEN_RATIO ||
					entry.intersectionRect.height >= viewport * SEEN_RATIO);
			if (seen) visibleMessages.add(rkey);
			else visibleMessages.delete(rkey);
		}
		flushSeen();
	};
	const observeSeen = (element: HTMLElement, rkey: string) => {
		seenObserver ??= new IntersectionObserver(onSeenEntries, {
			threshold: SEEN_THRESHOLDS,
		});
		seenTargets.set(element, rkey);
		seenObserver.observe(element);
		return () => {
			seenObserver?.unobserve(element);
			seenTargets.delete(element);
			visibleMessages.delete(rkey);
		};
	};
	createEffect(() => {
		if (!canSee()) return;
		unseen();
		flushSeen();
	});
	onCleanup(() => {
		seenObserver?.disconnect();
	});

	const selection = createMessageSelection({
		data,
		stack,
		spaceKey: options.space,
		community,
		space,
		feed,
		parent: view,
		anchoredThreads: threadsByAnchorRkey,
		isActive,
		desktop,
	});

	const inlineEditKey = () => {
		const target = editing();
		const channel = feed()?.channel;
		return desktop() && channel && target?.rkey
			? editDraftKey(channel, target.rkey)
			: undefined;
	};

	const threadMenu = createThreadMenu({
		space: options.space,
		channel: options.channel,
	});

	const reactionEmojiRef = (message: ChatMessage, emoji: string) => {
		const existing = reactionFor(message.view?.reactions, emoji)?.customEmoji;
		if (existing) return existing;
		const name = reactionShortcode(emoji);
		const current = community();
		const found =
			name && current ? data.emoji.find(current.did, name) : undefined;
		if (!found) return undefined;
		const { uri, cid } = found.ref;
		return (cid ? { uri, cid } : { uri }) as ReactionEmojiRef;
	};

	const chat: ChatContextValue = {
		viewer: () => data.viewer.did,
		platform,
		editingKey: () => editing()?.key,
		editDraft: () => {
			const key = inlineEditKey();
			return key ? readEditDraft(key) : undefined;
		},
		onEditChange: (value) => {
			const key = inlineEditKey();
			if (key) writeEditDraft(key, value);
		},
		onSaveEdit: async (value) => {
			const key = inlineEditKey();
			const saved = await saveEdit(value);
			if (saved && key) writeEditDraft(key, undefined);
			return saved;
		},
		onCancelEdit: () => {
			const key = inlineEditKey();
			if (key) writeEditDraft(key, undefined);
			setEditing(undefined);
			editor?.focus();
		},
		get editSources() {
			return sources;
		},
		emojiPacks,
		customEmoji: (name) => {
			const current = community();
			const emoji = current ? data.emoji.find(current.did, name) : undefined;
			return emoji
				? { id: emoji.id, name: emoji.name, src: emoji.image, alt: emoji.alt }
				: undefined;
		},
		customEmojiByUri: (uri) => {
			const emoji = data.emoji.resolve(community()?.did, uri);
			return emoji
				? { id: emoji.id, name: emoji.name, src: emoji.image, alt: emoji.alt }
				: undefined;
		},
		onCustomEmojiOpen: (emoji, anchor) => emojiDrawer.open(emoji, anchor),
		customEmojiFeature: (feature) =>
			data.emoji.mention(community()?.did, feature),
		community: () => community() as NonNullable<ReturnType<typeof community>>,
		members: memberMap,
		roles: roleMap,
		channels: channelMap,
		communities: () =>
			new Map(
				(data.communities.value() ?? []).map((entry) => [entry.did, entry]),
			),
		presenceOf: (did) => data.presenceOf(did as Did),
		membersLoaded: () => !!space()?.members.value(),
		threadName: (space) =>
			feed()
				?.threads.value()
				?.find((thread) => thread.space === space)?.name,
		threadChannel: (space) =>
			feed()
				?.threads.value()
				?.find((thread) => thread.space === space)?.channel,
		threadNameIn: (channel, thread) => {
			const parent = channelMap().get(channel);
			if (!parent) return undefined;
			return data
				.threadsOf(parent.space)
				.value()
				?.find((entry) => skeyOf(entry.space) === thread)?.name;
		},
		categoryName: (rkey) =>
			space()
				?.categories.value()
				?.find((category) => category.rkey === rkey)?.name,
		onOpenForwardSource: (target) => {
			const chat = {
				kind: "chat" as const,
				space: target.space,
				channel: target.channel,
				channelType: target.channelType,
			};
			if (target.space !== options.space) {
				stack.setRoot({ tab: "spaces", space: target.space });
			}
			const top = stack.top();
			const onChat =
				top?.kind === "chat" &&
				top.space === target.space &&
				top.channel === target.channel;
			if (target.thread) {
				if (top?.kind === "thread" && top.thread === target.thread) return;
				if (!onChat) stack.replaceTop(chat);
				stack.push({ ...chat, kind: "thread", thread: target.thread });
				return;
			}
			if (!onChat) stack.replaceTop(chat);
		},
		controls: data.controls,
		locale: "en-GB",
		quickReactions: () => topEmoji(session.usage(), QUICK_REACTION_COUNT),
		onRecordEmoji: (emoji) => session.recordEmoji(emoji),
		canPost: () => writable(),
		locked: () => !!options.thread?.()?.locked && !writable(),
		developerMode: () => data.controls().developerMode,
		viewerRoles: () => memberMap().get(data.viewer.did)?.roles ?? [],
		linkEmbedsEnabled: () =>
			(view()?.linkEmbeds ?? community()?.linkEmbeds) !== false,
		gifSaved: (gif) => media.favorites().some((entry) => entry.url === gif.url),
		onToggleGif: (gif, save) => {
			const saved = media.favorites().find((entry) => entry.url === gif.url);
			media.setFavorite((saved as GifView | undefined) ?? gif, save);
			toast.success(save ? "Saved GIF" : "Removed saved GIF");
		},
		onSetEmbeds: async (message, uris, as) => {
			const current = feed();
			if (!current || !message.rkey) return;
			const method =
				as === "author" ? "setSuppressedEmbeds" : "setModeratedEmbeds";
			try {
				await current.setSuppressedEmbeds(message.rkey, uris, as);
			} catch (error) {
				log.error("updating link previews failed", {
					code: classifyThrown(error, { method }).code,
				});
				toast.error("Couldn't update link previews");
			}
		},
		onOpenSpace: (community) => {
			stack.popTo(0);
			stack.setRoot({ tab: "spaces", space: spaceKey(community) });
		},
		loadBlueskyPost: (url) => {
			const cached = blueskyPosts.get(url);
			if (cached) return cached;
			const request = data.source.getBlueskyPost(url).catch((error) => {
				blueskyPosts.delete(url);
				log.warn("loading a Bluesky post failed", {
					code: classifyThrown(error, { method: "getBlueskyPost" }).code,
				});
				return undefined;
			});
			blueskyPosts.set(url, request);
			return request;
		},
		onReply: (message) => {
			setEditing(undefined);
			setReplyTo(message);
			if (desktop()) editor?.focus();
		},
		onEdit: (message) => {
			setReplyTo(undefined);
			setEditing(message);
		},
		onExternalLink: links.onExternalLink,
		canModerate,
		onSetHidden: (message, hidden) => {
			if (message.rkey) void feed()?.setHidden(message.rkey, hidden);
		},
		onPickReaction: (message) =>
			reactionPicker.open((emoji) => {
				if (message.rkey) void feed()?.react(message.rkey, emoji, true);
			}),
		onForward: (message) => {
			const current = feed();
			if (!message.rkey || !current) return;
			forwardPicker.open({
				channel: current.channel,
				rkey: message.rkey,
				preview: message.text || "Attachment",
			});
		},
		onDelete: (message) => {
			const current = feed();
			if (!current) return;
			if (message.state !== "sent") {
				current.discard(message.key);
				return;
			}
			if (message.rkey) void current.remove(message.rkey);
		},
		onReact: (message, emoji, add) => {
			if (message.rkey)
				void feed()?.react(
					message.rkey,
					emoji,
					add,
					reactionEmojiRef(message, emoji),
				);
		},
		onRetry: (message) => void feed()?.retry(message.key),
		onJumpTo: (rkey) => {
			if (!list?.jumpTo(keyFor(rkey))) void jumpWhenLoaded(rkey);
		},
		onOpenThread: (thread, open) =>
			stack.push({
				kind: "thread",
				space: options.space,
				channel: options.channel,
				thread: skeyOf(thread),
				...(open?.full && desktop() ? { presentation: "full" as const } : {}),
			}),
		onThreadMenu: (thread) => threadMenu.open(thread),
		ThreadContextMenu: threadMenu.ContextMenu,
		isUnseen: (rkey) => unseen().has(rkey),
		observeSeen,
		overlays: () => (
			<>
				<threadMenu.Overlay />
				<emojiDrawer.Overlay />
			</>
		),
		get onStartThread() {
			return canStartThread() ? startThread : undefined;
		},
		onOpenProfile: (did, anchor) =>
			profileSheet.open(did, options.space, { element: anchor }),
		onOpenMemberMenu: (did) => memberMenu.open(did, options.space),
		memberContextMenu: (did, trigger, wrapperClass) =>
			memberMenu.contextMenu(did, options.space, trigger, wrapperClass),
		onOpenChannel: (skey) =>
			stack.replaceTop({ kind: "chat", space: options.space, channel: skey }),
		selection,
	};

	const sources: RichEditorSources = {
		searchCustomEmoji: (query, limit) =>
			data.emoji.search(community()?.did, query, limit),
		customEmojiByName: (name) => {
			const current = community();
			const emoji = current ? data.emoji.find(current.did, name) : undefined;
			return emoji ? data.emoji.suggestion(emoji) : undefined;
		},
		resolveCustomEmoji: ({ uri }) => {
			const emoji = data.emoji.resolve(community()?.did, uri);
			return emoji ? data.emoji.suggestion(emoji) : undefined;
		},
		searchMembers: (query, limit) => {
			const needle = query.toLowerCase();
			const results = [];
			for (const member of memberMap().values()) {
				const name = displayNameOf(member.actor, member);
				if (
					name.toLowerCase().includes(needle) ||
					member.actor.handle.includes(needle)
				) {
					results.push({
						did: member.actor.did,
						name,
						handle: member.actor.handle,
						avatarSrc: member.actor.avatar,
						presence: uiPresence(data.presenceOf(member.actor.did)),
					});
					if (results.length >= limit) break;
				}
			}
			return results;
		},
		resolveMember: (did) => {
			const member = memberMap().get(did);
			return member
				? {
						did,
						name: displayNameOf(member.actor, member),
						handle: member.actor.handle,
						avatarSrc: member.actor.avatar,
					}
				: undefined;
		},
		roles: () =>
			[...roleMap().values()]
				.filter(isMentionableRole)
				.map((role) => ({ id: role.rkey, name: role.name, color: role.color })),
		channels: () =>
			[...channelMap().entries()].map(([skey, entry]) => ({
				id: skey,
				name: entry.name,
				kind:
					entry.type === "social.colibri.beta.channel.voice"
						? ("voice" as const)
						: ("text" as const),
			})),
		resolveChannel: (id) => {
			const entry = channelMap().get(id);
			return entry ? { label: entry.name } : undefined;
		},
		timeShortcut: true,
	};

	createEffect(
		on(
			() => options.channel,
			() => {
				setReplyTo(undefined);
				setEditing(undefined);
				attachments.clear();
			},
			{ defer: true },
		),
	);

	const linkPreviewsByDefault = () =>
		data.preferences.client().linkEmbedsByDefault;

	const send = async (
		value: { text: string; facets: unknown[] },
		sendOptions: { linkPreviews?: boolean } = {},
	) => {
		const current = feed();
		if (!current) return false;
		const payload = fromComposerValue(
			value as Parameters<typeof fromComposerValue>[0],
		);
		if (!payload.text && !attachments.hasAttachments()) return false;
		const converted = data.emoji.withFacets(
			community()?.did,
			payload.text,
			payload.facets,
		);
		payload.text = converted.text;
		payload.facets = converted.facets;
		const files = attachments.take();
		const parent = replyTo()?.rkey;
		const suppressedEmbeds = suppressedLinksFor(
			payload.facets,
			sendOptions.linkPreviews ?? linkPreviewsByDefault(),
		);
		setReplyTo(undefined);
		pinWhile(
			() => void current.send({ ...payload, parent, files, suppressedEmbeds }),
		);
		return true;
	};

	const saveEdit = async (value: { text: string; facets: unknown[] }) => {
		const target = editing();
		const current = feed();
		if (!target?.rkey || !current) return false;
		const payload = fromComposerValue(
			value as Parameters<typeof fromComposerValue>[0],
		);
		setEditing(undefined);
		if (desktop()) keepEditorFocus();
		const converted = data.emoji.withFacets(
			community()?.did,
			payload.text,
			payload.facets,
		);
		await current.edit(target.rkey, converted.text, converted.facets);
		return true;
	};

	const typingUsers = createMemo(() =>
		(feed()?.typing() ?? []).map((did) => {
			const author = authorForDid(did, directory());
			return {
				name: author?.name ?? nameOf(did),
				avatarSrc: author?.avatarSrc,
				seed: did,
				nameColor: author?.nameColor,
			};
		}),
	);

	const editLast = () => {
		const viewer = data.viewer.did;
		const last = [...items()]
			.reverse()
			.find(
				(message) =>
					message.author === viewer &&
					message.state === "sent" &&
					!message.anchor &&
					!!message.rkey,
			);
		if (!last) return false;
		setReplyTo(undefined);
		setEditing(last);
		return true;
	};

	let lastTyping = 0;
	const onInput = () => {
		const current = feed();
		const now = Date.now();
		if (!current || now - lastTyping < 3000) return;
		lastTyping = now;
		data.typing(current.channel);
	};

	return {
		data,
		stack,
		options,
		community,
		view,
		thread: () => options.thread?.(),
		writable,
		feed,
		items,
		unavailable,
		links,
		attachments,
		forwardPicker,
		media,
		reactionPicker,
		setEditor: (handle: RichEditorHandle) => {
			editor = handle;
		},
		focusComposer: () => {
			if (desktop()) editor?.focus();
		},
		platform,
		editLast,
		setMediaAnchor: (element: HTMLElement | undefined) => {
			mediaAnchor = element;
		},
		revealed,
		setAtBottom,
		chat,
		sources,
		replyTo,
		setReplyTo,
		editing,
		setEditing,
		muted,
		setMuted,
		nameOf,
		send,
		linkPreviewsByDefault,
		saveEdit,
		typingUsers,
		onInput,
		setList: (handle: MessageListHandle) => {
			list = handle;
		},
		laterRound,
		selection,
		deletedPing,
		setDeletedPing,
	};
};

export type Conversation = ReturnType<typeof createConversation>;

export const ConversationMessages = (props: {
	m: Conversation;
	header?: JSX.Element;
	platform?: "mobile" | "desktop";
}) => {
	const m = props.m;
	const mediaLinks = createMediaLinkRefresher({
		feed: m.feed,
		listMessages: (params) => m.data.source.listMessages(params),
	});
	return (
		<ChatContextProvider value={m.chat}>
			<MediaLinkContext.Provider value={mediaLinks}>
				<ChatRichTextProvider>
					<MessageList
						label={`Messages in ${m.options.label()}`}
						platform={props.platform ?? "mobile"}
						messages={m.items()}
						getKey={(message) => message.key}
						unreadAfter={(() => {
							const rkey = m.feed()?.unreadAfter();
							return rkey ? (m.data.nonceFor(rkey) ?? rkey) : undefined;
						})()}
						isOwnMessage={(message) => message.author === m.data.viewer.did}
						getAuthorName={(message) => m.nameOf(message.author)}
						locale="en-GB"
						hasOlder={!m.revealed() || (m.feed()?.hasOlder() ?? false)}
						bottomInset={COMPOSER_TYPING_INSET}
						jumpLift={COMPOSER_TYPING_INSET - 4}
						loadingOlder={m.feed()?.loadingOlder() || !m.revealed()}
						onLoadOlder={() => m.feed()?.loadOlder()}
						hasNewer={m.feed()?.hasNewer() ?? false}
						loadingNewer={m.feed()?.loadingNewer() ?? false}
						onLoadNewer={() => m.feed()?.loadNewer()}
						onJumpToLatest={() => m.feed()?.jumpToLatest()}
						onJump={m.focusComposer}
						onAtBottomChange={m.setAtBottom}
						ref={m.setList}
						header={props.header}
						empty={
							props.header ? undefined : (
								<div class="flex flex-1 flex-col items-center justify-center gap-1 px-8 text-center">
									<span class="text-base font-semibold">No messages yet</span>
									<span class="text-sm text-muted-foreground">
										{`Say hi in #${m.options.label()}.`}
									</span>
								</div>
							)
						}
					>
						{(entry) => <MessageItem entry={entry} />}
					</MessageList>
					<m.links.LinkWarningOutlet />
					<m.forwardPicker.Sheet />
					<m.media.Sheet />
					<m.reactionPicker.Sheet />
					<m.selection.Sheets />
				</ChatRichTextProvider>
			</MediaLinkContext.Provider>
		</ChatContextProvider>
	);
};

export const ConversationComposer = (props: {
	m: Conversation;
	platform?: "mobile" | "desktop";
}) => {
	const m = props.m;
	const desktop = () => props.platform === "desktop";
	const anchorMedia = (event: MouseEvent) =>
		m.setMediaAnchor(
			event.currentTarget instanceof HTMLElement
				? event.currentTarget
				: undefined,
		);
	const draftKey = () => m.feed()?.channel;
	const mobileEdit = () => (desktop() ? undefined : m.editing());
	const draft = createComposerDraft({
		key: draftKey,
		paused: () => !!mobileEdit(),
		attachments: {
			files: () => m.attachments.items().map((item) => item.file),
			add: (files) => m.attachments.addFiles(files),
		},
	});
	let editor: RichEditorHandle | undefined;
	const editKey = (target: ChatMessage) => {
		const channel = draftKey();
		return channel && target.rkey
			? editDraftKey(channel, target.rkey)
			: undefined;
	};
	const editing = createMemo(() => {
		const target = mobileEdit();
		if (!target) return undefined;
		const key = editKey(target);
		const finish = () => {
			if (key) writeEditDraft(key, undefined);
		};
		return {
			value: toTextValue(target.text, target.facets),
			preview: target.text,
			onSave: async (value: Parameters<typeof m.saveEdit>[0]) => {
				const saved = await m.saveEdit(value);
				if (saved) finish();
				return saved;
			},
			onCancel: () => {
				finish();
				m.setEditing(undefined);
			},
			onEmptySubmit: () => setConfirmingDelete(true),
		};
	});
	const [confirmingDelete, setConfirmingDelete] = createSignal(false);
	const deleteEdited = () => {
		const target = mobileEdit();
		if (!target) return;
		editing()?.onCancel();
		m.chat.onDelete(target);
	};
	createEffect(
		on(editing, (edit) => {
			const target = mobileEdit();
			const key = target && editKey(target);
			const stored = key ? readEditDraft(key) : undefined;
			if (!edit || !stored) return;
			requestAnimationFrame(() => {
				if (editing() === edit) editor?.setValue(stored);
			});
		}),
	);
	const onChange = (value: RichText) => {
		const target = mobileEdit();
		if (!target) {
			draft.changed();
			return;
		}
		const key = editKey(target);
		if (key) writeEditDraft(key, value);
	};
	const showLinkPreviews = () =>
		draft.linkPreviews() ?? m.linkPreviewsByDefault();
	const [closedNoticeDismissed, setClosedNoticeDismissed] = createSignal(false);
	createEffect(
		on(
			() => m.thread()?.closedAt,
			() => setClosedNoticeDismissed(false),
			{ defer: true },
		),
	);
	const send = async (value: Parameters<typeof m.send>[0]) => {
		const sent = await m.send(value, { linkPreviews: showLinkPreviews() });
		if (sent) draft.clear();
		return sent;
	};
	return (
		<Show when={m.view()}>
			<Show
				when={!m.selection.active()}
				fallback={<m.selection.Bar safeBottom={!desktop()} />}
			>
				<Composer
					platform={props.platform ?? "mobile"}
					safeBottom={!desktop()}
					onEditLast={desktop() ? m.editLast : undefined}
					onEscape={m.replyTo() ? () => m.setReplyTo(undefined) : undefined}
					channelName={m.options.label()}
					sources={m.sources}
					onSend={send}
					onInput={m.onInput}
					onChange={onChange}
					onUpload={() => m.attachments.pick()}
					onPasteFiles={(files) => m.attachments.addFiles(files)}
					hasAttachments={m.attachments.hasAttachments()}
					onEmoji={(event) => {
						anchorMedia(event);
						m.media.openEmoji();
					}}
					onGif={(event) => {
						anchorMedia(event);
						m.media.openGif();
					}}
					editorRef={(handle) => {
						editor = handle;
						m.setEditor(handle);
						draft.bind(handle);
					}}
					disabled={!m.writable()}
					disabledReason={
						m.thread()?.locked
							? LOCKED_THREAD_COPY
							: m.thread()
								? "You can't post in this thread."
								: "You can't post in this channel."
					}
					typing={<TypingIndicator size="sm" users={m.typingUsers()} />}
					top={
						<>
							<m.attachments.Tray />
							<ComposerBar
								open={!!m.thread()?.closedAt && !closedNoticeDismissed()}
								tone="info"
								kind="closed-thread"
								icon={<ArchiveDownMinimalisticIcon />}
								cancelLabel="Dismiss"
								onCancel={() => setClosedNoticeDismissed(true)}
							>
								{CLOSED_THREAD_COPY}
							</ComposerBar>
							<ComposerBar
								open={m.deletedPing()}
								tone="warning"
								kind="deleted-ping"
								icon={<TrashBinTrashIcon />}
								cancelLabel="Dismiss"
								onCancel={() => m.setDeletedPing(false)}
							>
								{DELETED_PING_COPY}
							</ComposerBar>
							<ReplyBar
								open={!!m.replyTo()}
								name={m.replyTo() ? m.nameOf(m.replyTo()?.author ?? "") : ""}
								onCancel={() => m.setReplyTo(undefined)}
							/>
						</>
					}
					editing={editing()}
					linkPreviews={
						m.chat.linkEmbedsEnabled?.() === false
							? undefined
							: showLinkPreviews()
					}
					onLinkPreviewsChange={draft.setLinkPreviews}
				/>
			</Show>
			<ConfirmDialog
				open={confirmingDelete()}
				onOpenChange={setConfirmingDelete}
				title={DELETE_CONFIRM_COPY.title}
				description={DELETE_CONFIRM_COPY.description}
				confirmLabel={DELETE_CONFIRM_COPY.confirm}
				tone="destructive"
				onConfirm={deleteEdited}
			/>
		</Show>
	);
};

export const UNAVAILABLE_COPY = {
	space: {
		title: "This Space isn't available",
		description: "It may have been deleted, or you're no longer a member.",
	},
	channel: {
		title: "This channel doesn't exist anymore",
		description:
			"It may have been deleted, or you no longer have access to it.",
	},
	thread: {
		title: "This thread doesn't exist anymore",
		description: "It may have been deleted or moved.",
	},
} as const;

export const ConversationUnavailable = (props: {
	kind: keyof typeof UNAVAILABLE_COPY;
	actionLabel: string;
	onAction: () => void;
}) => (
	<StatusScreen
		tone={props.kind === "space" ? "destructive" : "neutral"}
		icon={
			props.kind === "space" ? <DangerTriangleIcon /> : <ChatSquareDotsIcon />
		}
		title={UNAVAILABLE_COPY[props.kind].title}
		description={UNAVAILABLE_COPY[props.kind].description}
		actions={
			<Button block variant="secondary" onClick={props.onAction}>
				{props.actionLabel}
			</Button>
		}
	/>
);
