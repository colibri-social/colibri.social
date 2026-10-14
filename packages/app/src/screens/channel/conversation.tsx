import {
	Button,
	COMPOSER_TYPING_INSET,
	Composer,
	MessageList,
	type MessageListHandle,
	ReplyBar,
	type RichEditorHandle,
	type RichEditorSources,
	StatusScreen,
	TypingIndicator,
	toast,
} from "@colibri-social/ui";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
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
import { channelSlug, skeyOf } from "../../data/ids";
import { type ChannelData, useData } from "../../data/store";
import type {
	AttachmentView,
	ChannelView,
	Did,
	MemberView,
	MessageView,
	RoleView,
	SpaceRef,
	ThreadView,
} from "../../data/types";
import { usePlatform } from "../../screen/platform";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import { isCovered } from "../../shell/desktop/desktop-route";
import { useStack } from "../../shell/stack";
import { uiPresence } from "../members/member-adapter";
import { useMemberMenu } from "../members/member-menu";
import { useProfileSheet } from "../profile/profile-sheet";
import { createThreadMenu } from "../threads/thread-menu";
import {
	createComposerMedia,
	createReactionPicker,
	gifAttachment,
} from "./composer/media";
import { createAttachmentDraft } from "./composer/uploads/attachment-draft";
import { createForwardPicker } from "./forward/ForwardPicker";
import {
	ChatContextProvider,
	type ChatContextValue,
	ChatRichTextProvider,
} from "./message/chat-context";
import { createCustomEmojiDrawer } from "./message/custom-emoji-drawer";
import { createLinkOpener } from "./message/link-opener";
import { MessageItem } from "./message/MessageItem";
import {
	type ChatMessage,
	failChatMessage,
	isHiddenMessage,
	pendingChatMessage,
	toChatMessage,
} from "./message/types";
import { createMessageSelection } from "./selection/selection";

export type ConversationOptions = {
	space: string;
	channel: string;
	target: () => SpaceRef | undefined;
	label: () => string;
	isActive: () => boolean;
};

const MAX_JUMP_PAGES = 12;
const SEEN_RATIO = 0.6;
const SEEN_THRESHOLDS = [0, 0.25, 0.5, SEEN_RATIO, 0.8, 1];

export const laterRound = (label: string) => () =>
	toast.info(`${label} arrives in a later round`);

export const createConversation = (options: ConversationOptions) => {
	const data = useData();
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
			list?.scrollToBottom({ smooth: true });
			void feed()?.send({ text: "", attachments: [gifAttachment(gif)] });
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
	const unavailable = createMemo<"space" | "channel" | "thread" | undefined>(
		() => {
			if (data.communities.loading()) return undefined;
			const current = space();
			if (!current) return "space";
			if (current.channels.loading()) return undefined;
			return view() ? undefined : "channel";
		},
	);
	const feed = createMemo(() => {
		const ref = options.target();
		return ref ? data.channel(ref) : undefined;
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

	const isActive = options.isActive;

	let entered: ChannelData | undefined;
	let ownDepth = 0;
	let covered = false;
	createEffect(() => {
		const current = feed();
		if (!current || !isActive()) return;
		const fresh = entered !== current;
		entered = current;
		ownDepth = untrack(stack.activeDepth);
		const firstUnread = untrack(() => current.enter(fresh));
		if (firstUnread && !fresh && (!covered || list?.isAtBottom())) {
			const key = data.nonceFor(firstUnread) ?? firstUnread;
			requestAnimationFrame(() =>
				list?.jumpTo(key, { align: "start", smooth: false, highlight: false }),
			);
		}
		onCleanup(() => {
			covered = untrack(stack.activeDepth) > ownDepth;
		});
		data.setViewing(current.channel);
		if (options.space && options.channel) {
			data.setLastChannel(options.space, options.channel);
		}
		current.markRead();
		onCleanup(() => data.setViewing(undefined));
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
	const threadsByAnchor = createMemo(() => {
		const map = new Map<string, ThreadView>();
		for (const thread of feed()?.threads.value() ?? []) {
			const anchor = thread.anchorMessage as { rkey?: string } | undefined;
			if (anchor?.rkey) map.set(anchor.rkey, thread);
		}
		return map;
	});

	const [revealed, setRevealed] = createSignal(false);
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
			!atBottom() ||
			!revealed() ||
			!isActive() ||
			modalOpen() ||
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
		for (let attempt = 0; attempt < MAX_JUMP_PAGES; attempt++) {
			await nextFrame();
			if (list?.jumpTo(keyFor(rkey))) return;
			const current = feed();
			if (!current) return;
			if (current.messages().some((message) => message.rkey === rkey)) {
				continue;
			}
			if (!current.hasOlder()) break;
			current.loadOlder();
			while (current.loadingOlder()) await nextFrame();
		}
		toast.info("That message is not loaded");
	};

	createEffect(() => {
		const ref = options.target();
		const request = data.jumps.pending();
		if (!ref || !revealed() || request?.channel !== ref) return;
		const rkey = data.jumps.take(ref);
		if (rkey) void jumpWhenLoaded(rkey);
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
				const thread = threads.get(message.rkey);
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
				? data.viewer.displayName
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
		isActive() &&
		!modalOpen() &&
		!stack.moving() &&
		document.visibilityState === "visible";
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
	document.addEventListener("visibilitychange", flushSeen);
	onCleanup(() => {
		document.removeEventListener("visibilitychange", flushSeen);
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
		anchoredThreads: threadsByAnchor,
		isActive,
		desktop,
	});

	const threadMenu = createThreadMenu({
		space: options.space,
		channel: options.channel,
	});

	const chat: ChatContextValue = {
		viewer: () => data.viewer.did,
		platform,
		editingKey: () => editing()?.key,
		onSaveEdit: (value) => saveEdit(value),
		onCancelEdit: () => {
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
			if (message.rkey) void feed()?.react(message.rkey, emoji, add);
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
				.filter((role) => role.mentionable)
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

	const send = async (value: { text: string; facets: unknown[] }) => {
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
		setReplyTo(undefined);
		list?.scrollToBottom({ smooth: true });
		void current.send({ ...payload, parent, files });
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
		saveEdit,
		typingUsers,
		onInput,
		setList: (handle: MessageListHandle) => {
			list = handle;
		},
		laterRound,
		selection,
	};
};

export type Conversation = ReturnType<typeof createConversation>;

export const ConversationMessages = (props: {
	m: Conversation;
	header?: JSX.Element;
	platform?: "mobile" | "desktop";
}) => {
	const m = props.m;
	return (
		<ChatContextProvider value={m.chat}>
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
					bottomInset={
						props.platform === "desktop" ? undefined : COMPOSER_TYPING_INSET
					}
					jumpLift={
						props.platform !== "desktop" && m.typingUsers().length ? 24 : 0
					}
					loadingOlder={m.feed()?.loadingOlder() || !m.revealed()}
					onLoadOlder={() => m.feed()?.loadOlder()}
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
	return (
		<Show when={m.view()}>
			{(current) => (
				<Show
					when={!m.selection.active()}
					fallback={<m.selection.Bar safeBottom={!desktop()} />}
				>
					<Composer
						platform={props.platform ?? "mobile"}
						safeBottom={!desktop()}
						onEditLast={desktop() ? m.editLast : undefined}
						channelName={m.options.label()}
						sources={m.sources}
						onSend={m.send}
						onInput={m.onInput}
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
						editorRef={m.setEditor}
						disabled={current().viewer.canPost === false}
						disabledReason="You can't post in this channel."
						typing={<TypingIndicator size="sm" users={m.typingUsers()} />}
						top={
							<>
								<m.attachments.Tray />
								<ReplyBar
									open={!!m.replyTo()}
									name={m.replyTo() ? m.nameOf(m.replyTo()?.author ?? "") : ""}
									onCancel={() => m.setReplyTo(undefined)}
								/>
							</>
						}
						editing={(() => {
							const target = m.editing();
							if (!target || desktop()) return undefined;
							return {
								value: toTextValue(target.text, target.facets),
								preview: target.text,
								onSave: m.saveEdit,
								onCancel: () => m.setEditing(undefined),
							};
						})()}
					/>
				</Show>
			)}
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
