import type { AT_URI, ColibriRichTextFacet } from "@colibri-social/lib";
import {
	type Accessor,
	batch,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	onMount,
	type ParentComponent,
	untrack,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { namespace } from "../atproto/cache/keys";
import {
	buildMessagesSnapshot,
	isSnapshotPaintable,
	reconcileFetchedWindow,
	restoreMessagesSnapshot,
	rkeyOf,
	shouldWriteSnapshot,
	snapshotAgeMs,
} from "../atproto/cache/messages-snapshot";
import { registerOpenChannel } from "../atproto/cache/messages-writer";
import type { MessagesSnapshot } from "../atproto/cache/schema";
import {
	createSnapshotScheduler,
	realSnapshotClock,
} from "../atproto/cache/snapshot-scheduler";
import {
	cacheEnabled,
	readMessages,
	writeMessages,
} from "../atproto/cache/store";
import { takeChannelView } from "../atproto/channel-prefetch";
import { communityUriToUrlCompatible } from "../atproto/community-uri-to-url-compatible";
import {
	enqueuePut,
	onOutboxSent,
	outboxRevision,
	queuedRecords,
} from "../atproto/outbox/outbox";
import { rehydrateQueuedMessages } from "../atproto/outbox/rehydrate";
import { writeReadCursor } from "../atproto/read-cursor";
import type {
	Message,
	PendingMessage,
} from "../atproto/xrpc/social/colibri/channel/listMessages";
import type { Channel } from "../atproto/xrpc/social/colibri/community/listChannels";
import { isPingKind } from "../atproto/xrpc/social/colibri/notification/getUnseen";
import { trimWithFacets } from "../components/app/common/rich-text-renderer/util";
import { classifyThrown } from "../errors/classify";
import type { ColibriError } from "../errors/error";
import { getAppViewDid } from "../utils/appview";
import { AtURI } from "../utils/at-uri";
import { clearEditDraft } from "../utils/composer-drafts";
import { createLogger } from "../utils/logger";
import { insertAt, placeMessage } from "../utils/message-order";
import { markBoot } from "../utils/perf";
import { purify } from "../utils/purify";
import { useCommunityContext } from "./Community";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";

/**
 * How long a typing indicator stays active without a refreshing `start`
 * event before it auto-clears, in ms. A safety net in case a `stop` event
 * is dropped.
 */
const TYPING_HOLD_MS = 5000;

export const PAGE_SIZE = 50;

const CACHE_WRITE_MAX_INTERVAL_MS = 5000;

const CACHE_WRITE_DEBOUNCE_MS = 400;

const CATCHUP_MIN_INTERVAL_MS = 1500;

/**
 * How long a `focusedMessage` stays "set" before it auto-clears, in ms. The
 * auto-clear is what lets the same message be jumped to twice in a row — the
 * effect that scrolls into view sees the value change back to `undefined`
 * and then to the URI again.
 */
const FOCUS_HOLD_MS = 2000;

/**
 * Safety cap on `loadOlder()` iterations during `jumpToMessage`. Stops a
 * pathological case (bad URI, server bug) from running forever.
 */
const JUMP_FETCH_CAP = 50;

export type UnseenEntry = {
	uri: string;
	isPing: boolean;
};

export type LoadOlderHooks = {
	prepare?: (messages: Array<Message>) => Promise<void>;
	onBeforePrepend?: () => void;
	onAfterPrepend?: () => void;
};

export type ChannelContextValue = {
	/**
	 * The full channel record (name, type, uri, category...) filtered out of
	 * the community context by the layout wrapper. May be `undefined` for a
	 * brief tick on mount, or if the route param doesn't match any channel
	 * in the current community (e.g. stale link).
	 */
	data: Accessor<Channel | undefined>;
	channelUri: Accessor<string>;
	messages: Accessor<(Message | PendingMessage)[]>;
	hasMore: Accessor<boolean>;
	loadingOlder: Accessor<boolean>;
	initialLoading: Accessor<boolean>;
	error: Accessor<ColibriError | undefined>;
	loadOlder: (hooks?: LoadOlderHooks) => Promise<void>;

	snapshotAge: Accessor<number | undefined>;
	hydratedFromNetwork: Accessor<boolean>;

	/**
	 * The message the user is currently composing a reply to, or `undefined`.
	 * Held as a full `Message` record so the composer can render an inline
	 * preview without a re-lookup. Persists across channel switches by
	 * design — the composer is expected to clear it manually when sent.
	 */
	replyingTo: Accessor<Message | undefined>;
	setReplyingTo: (message: Message) => void;
	clearReplyingTo: () => void;

	/**
	 * The message the user is currently editing, or `undefined`. Persists
	 * across channel switches.
	 */
	editingMessage: Accessor<Message | undefined>;
	setEditingMessage: (message: Message) => void;
	clearEditingMessage: () => void;
	submitMessageEdit: (
		text: string,
		facets: ColibriRichTextFacet[],
	) => Promise<boolean>;
	cancelMessageEdit: () => void;
	emptyEditPendingDeletion: Accessor<Message | undefined>;
	clearEmptyEditPendingDeletion: () => void;

	/**
	 * The URI of the message that should be scrolled into view + highlighted.
	 * Auto-clears after `FOCUS_HOLD_MS`. Set via `jumpToMessage`, never via
	 * a direct setter. The auto-clear is deliberate.
	 */
	focusedMessage: Accessor<string | undefined>;

	/**
	 * Sets `focusedMessage` to `uri`. If the message isn't in the loaded
	 * `messages()` buffer, walks `loadOlder()` until it is (or until the
	 * channel hits the top, or until `JUMP_FETCH_CAP` pages have loaded).
	 * The actual scroll-into-view is the layout's responsibility — it
	 * watches `focusedMessage()` in an effect.
	 */
	jumpToMessage: (uri: string) => Promise<void>;

	// ---------------------------------------------------------------------------
	// Optimistic message management
	// ---------------------------------------------------------------------------

	/** Append a pending (grey) message to the bottom of the list. */
	addPendingMessage: (msg: PendingMessage) => void;
	/**
	 * Replace the pending message identified by `hash` with its confirmed
	 * AT-URI once the PDS responds. Removes the `hash` field so the row
	 * re-renders as a regular confirmed message.
	 */
	confirmPendingMessage: (hash: string, confirmedUri: string) => void;
	/** Remove a pending message (on send error). */
	removePendingMessage: (hash: string) => void;
	/** Remove a confirmed message by URI (deletion / block). */
	removeMessage: (uri: string) => void;
	/**
	 * Update the stored text + facets of a message after a successful edit,
	 * and set `edited: true` so the "(edited)" marker appears.
	 */
	updateMessageText: (
		uri: string,
		text: string,
		facets: ColibriRichTextFacet[],
	) => void;

	// ---------------------------------------------------------------------------
	// Optimistic reaction management
	// ---------------------------------------------------------------------------

	addReactionOptimistic: (
		messageUri: string,
		emoji: string,
		reactorDid: string,
	) => void;
	removeReactionOptimistic: (
		messageUri: string,
		emoji: string,
		reactorDid: string,
	) => void;

	/**
	 * Store the rkey returned by the PDS after creating a reaction so it can
	 * be looked up when the user wants to remove the same reaction.
	 */
	cacheReactionRkey: (messageUri: string, emoji: string, rkey: string) => void;
	getReactionRkey: (messageUri: string, emoji: string) => string | undefined;

	// ---------------------------------------------------------------------------
	// Real-time
	// ---------------------------------------------------------------------------

	/** DIDs of users currently typing in this channel (excludes self). */
	typingUsers: Accessor<string[]>;
	/**
	 * Ping the AppView that the local user is typing in this channel. The
	 * AppView broadcasts a `typing_event` to everyone viewing the channel;
	 * receivers auto-clear after `TYPING_HOLD_MS`. Call repeatedly (throttled)
	 * while the user is actively typing — there is no explicit "stop".
	 */
	sendTyping: () => void;
	/**
	 * Monotonic counter bumped whenever a message arrives from another user
	 * via the socket. The layout watches this to decide whether to auto-scroll.
	 */
	newIncomingMessage: Accessor<number>;
	/**
	 * Monotonic counter bumped whenever the local user sends a message (a
	 * pending message is appended). The layout watches this to scroll the
	 * newly-sent message into view unconditionally.
	 */
	outgoingMessage: Accessor<number>;

	/**
	 * URI of the last message the current user has read in this channel.
	 * Messages after this URI are "new" and a divider is shown above them.
	 * `undefined` when there is no unread boundary (user is up-to-date).
	 */
	readCursorUri: Accessor<string | undefined>;
	readCursorResolved: Accessor<boolean>;
	initialUnseen: Accessor<UnseenEntry[]>;
	advanceReadCursor: (explicitUri?: string) => void;
	clearUnreadBoundary: () => void;
};

const log = createLogger("channel");

export const ChannelContext = createContext<ChannelContextValue>();

export const ChannelContextProvider: ParentComponent<{
	channel: Accessor<Channel | undefined>;
}> = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const community = useCommunityContext();

	const ns = () => namespace(getAppViewDid(), user.did);

	// The channel record is filtered out of the community context by the
	// layout wrapper and passed in here. We derive the URI from it directly
	// — no separate `buildChannelUri` helper is required anymore.
	const channelUri = createMemo(() => props.channel()?.uri ?? "");

	// Messages are kept oldest-first so they render naturally top-to-bottom in
	// the scroll container (newest at the visual bottom, like a chat). The
	// server returns pages newest-first, so we reverse each page before
	// prepending.
	const [messages, setMessages] = createSignal<(Message | PendingMessage)[]>(
		[],
	);
	// In-memory cache: messageUri → emoji → rkey. Populated when a reaction
	// is created; consulted before the fallback listRecords call when removing.
	const reactionRkeyCache = new Map<string, Map<string, string>>();
	const [cursor, setCursor] = createSignal<string | undefined>(undefined);
	const [hasMore, setHasMore] = createSignal(true);
	const [loadingOlder, setLoadingOlder] = createSignal(false);
	const [initialLoading, setInitialLoading] = createSignal(true);
	const [error, setError] = createSignal<ColibriError | undefined>(undefined);
	const [readCursorUri, setReadCursorUri] = createSignal<string | undefined>(
		undefined,
	);
	const [readCursorResolved, setReadCursorResolved] = createSignal(false);
	const [initialUnseen, setInitialUnseen] = createSignal<UnseenEntry[]>([]);
	const [snapshotAge, setSnapshotAge] = createSignal<number | undefined>(
		undefined,
	);
	const [hydratedFromNetwork, setHydratedFromNetwork] = createSignal(false);
	const [appliedRemoval, setAppliedRemoval] = createSignal(false);
	let paintedAt: number | undefined;

	// Reply / edit / focus state. Configured with `equals: false` so that
	// re-asserting the same message (e.g. clicking "Reply" on the same row
	// twice, or jumping to the same message twice) still emits a change and
	// re-triggers consumers (input focus, scroll-into-view, highlight). This
	// state intentionally persists across channel switches — `reset()` does
	// not touch it.
	const [replyingTo, setReplyingTo] = createSignal<Message | undefined>(
		undefined,
		{ equals: false },
	);
	const [editingMessage, setEditingMessage] = createSignal<Message | undefined>(
		undefined,
		{ equals: false },
	);
	const [emptyEditPendingDeletion, setEmptyEditPendingDeletion] = createSignal<
		Message | undefined
	>(undefined, { equals: false });
	const clearEmptyEditPendingDeletion = () =>
		setEmptyEditPendingDeletion(undefined);
	const [focusedMessage, setFocusedMessage] = createSignal<string | undefined>(
		undefined,
		{ equals: false },
	);

	// Outstanding `setTimeout` for the auto-clear on `focusedMessage`. We
	// cancel it whenever a new jump comes in so a rapid second jump doesn't
	// get prematurely cleared by the first one's pending timer.
	let focusClearTimer: ReturnType<typeof setTimeout> | undefined;

	// Module-local flag guards against overlapping fetches (matches the
	// `inflight` pattern in the old Astro `useMessageHistory` hook).
	let inflight = false;

	let lastViewAt = 0;

	const reset = () => {
		inflight = false;
		lastViewAt = 0;
		paintedAt = undefined;
		reactionRkeyCache.clear();
		batch(() => {
			setMessages([]);
			setCursor(undefined);
			setHasMore(true);
			setLoadingOlder(false);
			setInitialLoading(true);
			setError(undefined);
			setReadCursorUri(undefined);
			setReadCursorResolved(false);
			setInitialUnseen([]);
			setSnapshotAge(undefined);
			setHydratedFromNetwork(false);
			setAppliedRemoval(false);
		});
	};

	const loadOlder = async (hooks?: LoadOlderHooks): Promise<void> => {
		if (inflight) return;
		if (!hasMore()) return;
		const uri = channelUri();
		if (!uri) return;

		inflight = true;
		setLoadingOlder(true);
		try {
			const res = await user.xrpc.social.colibri.channel.listMessages(
				uri,
				PAGE_SIZE,
				cursor(),
				undefined,
			);

			// If the channel was switched mid-flight, discard the result entirely
			// — `reset()` will already have cleared state for the new channel.
			if (uri !== channelUri()) return;

			if (!res.ok) {
				setError(res.error);
				return;
			}

			setError(undefined);
			const fetched = res.data?.messages ?? [];

			if (fetched.length === 0) {
				setHasMore(false);
				return;
			}

			// Server pages are newest-first; reverse to oldest-first for
			// prepending so the merged array stays oldest→newest.
			const olderChunk = [...fetched].reverse();
			const existingUris = new Set(messages().map((m) => m.uri));
			const novel = olderChunk.filter((m) => !existingUris.has(m.uri));
			const hitTop = fetched.length < PAGE_SIZE;

			if (hooks?.prepare) await hooks.prepare(novel);
			if (uri !== channelUri()) return;

			hooks?.onBeforePrepend?.();
			batch(() => {
				setMessages((prev) => [...novel, ...prev]);
				const newOldest = olderChunk[0];
				if (newOldest) setCursor(rkeyOf(newOldest.uri));
				if (hitTop) setHasMore(false);
			});
			hooks?.onAfterPrepend?.();
		} catch (err) {
			const failure = classifyThrown(err, { method: "channel.listMessages" });
			log.error("loadOlder failed", { code: failure.code });
			setError(failure);
		} finally {
			inflight = false;
			batch(() => {
				setLoadingOlder(false);
				setInitialLoading(false);
			});
		}
	};

	const loadInitial = async (): Promise<void> => {
		const uri = channelUri();
		if (!uri) return;

		inflight = true;
		setLoadingOlder(true);

		try {
			const primed = takeChannelView(uri);
			if (primed) markBoot("prefetch:consumed");
			const view =
				(await primed) ??
				(await user.xrpc.social.colibri.channel.getChannelView(uri, PAGE_SIZE));

			if (uri !== channelUri()) return;

			if (!view.ok) {
				setError(view.error);
				return;
			}

			const channel = view.data;
			const ordered = [...(channel?.messages ?? [])].reverse();

			const stillPending = messages().filter(
				(m) => "hash" in m && !ordered.some((o) => o.uri === m.uri),
			);

			batch(() => {
				setError(undefined);
				setMessages([...ordered, ...stillPending]);
				const oldest = ordered[0];
				if (oldest) setCursor(rkeyOf(oldest.uri));
				setHasMore(ordered.length >= PAGE_SIZE);
				setReadCursorUri(channel?.readCursor?.cursor);
				setInitialUnseen(
					(channel?.unseen ?? []).map((n) => ({
						uri: n.messageUri,
						isPing: isPingKind(n.kind),
					})),
				);
				setHydratedFromNetwork(true);
			});
			lastViewAt = Date.now();
		} catch (err) {
			const failure = classifyThrown(err, { method: "channel.getChannelView" });
			log.error("loadInitial failed", { code: failure.code });
			setError(failure);
		} finally {
			inflight = false;
			batch(() => {
				setLoadingOlder(false);
				setInitialLoading(false);
			});
			if (uri === channelUri()) setReadCursorResolved(true);
		}
	};

	const snapshotWrites = createSnapshotScheduler<
		{ ns: string; uri: string; snap: MessagesSnapshot },
		ReturnType<typeof setTimeout>
	>({
		maxIntervalMs: CACHE_WRITE_MAX_INTERVAL_MS,
		debounceMs: CACHE_WRITE_DEBOUNCE_MS,
		clock: realSnapshotClock,
		write: (queued) => {
			void writeMessages(queued.ns, queued.uri, queued.snap);
		},
	});

	const flushSnapshot = () => snapshotWrites.flush();

	// Reset state and seed the first page whenever the channel URI changes
	// (including the initial mount). `on` makes the dependency explicit.
	createEffect(
		on(channelUri, (uri) => {
			flushSnapshot();
			registerOpenChannel(uri);
			if (!uri) return;
			reset();
			loadInitial();
		}),
	);
	onCleanup(() => registerOpenChannel(undefined));

	createEffect(() => {
		if (!initialLoading()) markBoot("channel:firstPage");
	});

	createEffect(
		on(channelUri, async (uri) => {
			if (!cacheEnabled() || !uri) return;
			const cached = await readMessages(ns(), uri);
			if (!cached) return;
			const age = snapshotAgeMs(cached, Date.now());
			if (!isSnapshotPaintable(age)) return;
			if (uri !== channelUri() || hydratedFromNetwork()) return;
			if (messages().length > 0) return;
			const restored = restoreMessagesSnapshot(cached);
			paintedAt = cached.ts;
			batch(() => {
				setMessages(cached.messages);
				if (restored.cursor) setCursor(restored.cursor);
				if (restored.hasMore !== undefined) setHasMore(restored.hasMore);
				setReadCursorUri(cached.readCursor);
				setSnapshotAge(age);
				setInitialLoading(false);
				markBoot("cache:paint");
			});
		}),
	);

	createEffect(() => {
		const uri = channelUri();
		outboxRevision();
		if (!uri || initialLoading()) return;
		untrack(() => {
			const reconciled = rehydrateQueuedMessages({
				channelUri: uri,
				community: community().community.uri,
				author: {
					did: user.did,
					handle: user.handle.replaceAll("at://", ""),
					data: user.data,
				},
				queued: queuedRecords("social.colibri.message"),
				existing: messages(),
			});
			if (reconciled) setMessages(reconciled);
		});
	});

	createEffect(() => {
		const uri = channelUri();
		const confirmed = messages().filter(
			(m) => !("hash" in m) && m.uri.startsWith("at://"),
		);
		const hydrated = hydratedFromNetwork();
		const gate = {
			cacheEnabled: cacheEnabled(),
			channelUri: uri,
			hydratedFromNetwork: hydrated,
			appliedRemoval: appliedRemoval(),
		};
		if (!shouldWriteSnapshot(gate)) return;
		snapshotWrites.schedule({
			ns: ns(),
			uri,
			snap: buildMessagesSnapshot(confirmed, {
				readCursor: readCursorUri(),
				hasMore: hasMore(),
				limit: PAGE_SIZE,
				now: hydrated ? Date.now() : (paintedAt ?? Date.now()),
			}),
		});
	});

	const onHidden = () => {
		if (document.visibilityState === "hidden") flushSnapshot();
	};
	onMount(() => {
		document.addEventListener("visibilitychange", onHidden);
		window.addEventListener("pagehide", flushSnapshot);
	});
	onCleanup(() => {
		document.removeEventListener("visibilitychange", onHidden);
		window.removeEventListener("pagehide", flushSnapshot);
		flushSnapshot();
	});

	const clearReplyingTo = () => setReplyingTo(undefined);
	const clearEditingMessage = () => setEditingMessage(undefined);

	const jumpToMessage = async (uri: string): Promise<void> => {
		// Walk `loadOlder()` until the target appears in the buffer (or we hit
		// the top of the channel, or trip the safety cap). `loadOlder` itself
		// is inflight-guarded, so consecutive awaits serialize cleanly.
		let fetches = 0;
		while (
			fetches < JUMP_FETCH_CAP &&
			!messages().some((m) => m.uri === uri) &&
			hasMore()
		) {
			await loadOlder();
			fetches++;
		}

		if (focusClearTimer !== undefined) clearTimeout(focusClearTimer);
		setFocusedMessage(uri);
		focusClearTimer = setTimeout(() => {
			setFocusedMessage(undefined);
			focusClearTimer = undefined;
		}, FOCUS_HOLD_MS);
	};

	// ---------------------------------------------------------------------------
	// Optimistic message helpers
	// ---------------------------------------------------------------------------

	const addPendingMessage = (msg: PendingMessage) => {
		setMessages((prev) =>
			prev.some((m) => m.uri === msg.uri)
				? prev.map((m) => (m.uri === msg.uri ? msg : m))
				: [...prev, msg],
		);
		setReadCursorUri(undefined);
		setOutgoingMessage((n) => n + 1);
	};

	const confirmPendingMessage = (hash: string, confirmedUri: string) => {
		setMessages((prev) =>
			prev.map((m) => {
				if ("hash" in m && (m as PendingMessage).hash === hash) {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					const { hash: _h, ...rest } = m as PendingMessage;
					return { ...rest, uri: confirmedUri } as Message;
				}
				return m;
			}),
		);
	};

	const removePendingMessage = (hash: string) => {
		setMessages((prev) =>
			prev.filter((m) => !("hash" in m && (m as PendingMessage).hash === hash)),
		);
	};

	const removeMessage = (uri: string) => {
		const before = messages();
		const remaining = before.filter((m) => m.uri !== uri);
		if (remaining.length === before.length) return;
		batch(() => {
			setMessages(remaining);
			setAppliedRemoval(true);
		});
	};

	const updateMessageText = (
		uri: string,
		text: string,
		facets: ColibriRichTextFacet[],
		edited: boolean = true,
	) => {
		setMessages((prev) =>
			prev.map((m) => (m.uri === uri ? { ...m, text, facets, edited } : m)),
		);
	};

	const submitMessageEdit = async (
		text: string,
		facets: ColibriRichTextFacet[],
	): Promise<boolean> => {
		const target = editingMessage();
		if (!target) return false;

		const rkey = AtURI.parseAtURI(target.uri).identifier;
		const trimmed = trimWithFacets({ text, facets });
		const cleanText = purify(trimmed.text);
		const cleanFacets = trimmed.facets;

		if (cleanText.length === 0) {
			clearEditDraft(target.uri);
			clearEditingMessage();
			setEmptyEditPendingDeletion(target);
			return true;
		}

		const originalText = target.text;
		const originalFacets = target.facets;
		const originalEdited = target.edited;

		updateMessageText(target.uri, cleanText, cleanFacets, true); // optimistic
		clearEditDraft(target.uri);
		clearEditingMessage();

		try {
			await enqueuePut(
				user.did,
				"social.colibri.message",
				rkey,
				{
					text: cleanText,
					facets: cleanFacets,
					channel: target.channel,
					createdAt: target.createdAt,
					edited: true,
					...(target.parent ? { parent: target.parent.uri } : {}),
				},
				{ label: "Failed to edit message." },
			);
		} catch {
			updateMessageText(
				target.uri,
				originalText,
				originalFacets,
				originalEdited,
			);
			setEditingMessage(target);
			toast.error("Failed to edit message.");
		}

		return true;
	};

	const cancelMessageEdit = () => {
		const target = editingMessage();
		if (target) clearEditDraft(target.uri);
		clearEditingMessage();
	};

	// ---------------------------------------------------------------------------
	// Optimistic reaction helpers
	// ---------------------------------------------------------------------------

	const addReactionOptimistic = (
		messageUri: string,
		emoji: string,
		reactorDid: string,
	) => {
		setMessages((prev) =>
			prev.map((m) => {
				if (m.uri !== messageUri) return m;
				const existing = m.reactions.find((r) => r.emoji === emoji);
				if (existing) {
					if (existing.reactorDIDs.includes(reactorDid)) return m;
					return {
						...m,
						reactions: m.reactions.map((r) =>
							r.emoji === emoji
								? {
										...r,
										count: r.count + 1,
										reactorDIDs: [...r.reactorDIDs, reactorDid],
									}
								: r,
						),
					};
				}
				return {
					...m,
					reactions: [
						...m.reactions,
						{ emoji, count: 1, reactorDIDs: [reactorDid] },
					],
				};
			}),
		);
	};

	const removeReactionOptimistic = (
		messageUri: string,
		emoji: string,
		reactorDid: string,
	) => {
		setMessages((prev) =>
			prev.map((m) => {
				if (m.uri !== messageUri) return m;
				const existing = m.reactions.find((r) => r.emoji === emoji);
				if (!existing?.reactorDIDs.includes(reactorDid)) return m;
				return {
					...m,
					reactions: m.reactions
						.map((r) =>
							r.emoji === emoji
								? {
										...r,
										count: r.count - 1,
										reactorDIDs: r.reactorDIDs.filter((d) => d !== reactorDid),
									}
								: r,
						)
						.filter((r) => r.count > 0),
				};
			}),
		);
	};

	const cacheReactionRkey = (
		messageUri: string,
		emoji: string,
		rkey: string,
	) => {
		if (!reactionRkeyCache.has(messageUri)) {
			reactionRkeyCache.set(messageUri, new Map());
		}
		reactionRkeyCache.get(messageUri)!.set(emoji, rkey);
	};

	const getReactionRkey = (
		messageUri: string,
		emoji: string,
	): string | undefined => {
		return reactionRkeyCache.get(messageUri)?.get(emoji);
	};

	// ---------------------------------------------------------------------------
	// Real-time: typing indicators
	// ---------------------------------------------------------------------------

	const [typingUsers, setTypingUsers] = createSignal<string[]>([]);
	const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

	const addTyping = (did: string) => {
		setTypingUsers((prev) => (prev.includes(did) ? prev : [...prev, did]));
		const existing = typingTimers.get(did);
		if (existing) clearTimeout(existing);
		typingTimers.set(
			did,
			setTimeout(() => {
				setTypingUsers((prev) => prev.filter((d) => d !== did));
				typingTimers.delete(did);
			}, TYPING_HOLD_MS),
		);
	};

	const removeTyping = (did: string) => {
		const existing = typingTimers.get(did);
		if (existing) {
			clearTimeout(existing);
			typingTimers.delete(did);
		}
		setTypingUsers((prev) => prev.filter((d) => d !== did));
	};

	const sendTyping = () => {
		const uri = channelUri();
		if (!uri) return;
		socket.send({ type: "typing", data: { channel: uri } });
	};

	// Clear typing state when switching channels.
	createEffect(
		on(channelUri, () => {
			typingTimers.forEach((t) => {
				clearTimeout(t);
			});
			typingTimers.clear();
			setTypingUsers([]);
		}),
	);

	// ---------------------------------------------------------------------------
	// Real-time: incoming socket events
	// ---------------------------------------------------------------------------

	const [newIncomingMessage, setNewIncomingMessage] = createSignal(0);
	const [outgoingMessage, setOutgoingMessage] = createSignal(0);

	// Inform the AppView which channel the user is viewing (drives typing-event
	// fan-out and read tracking on the server side). Re-sends whenever the
	// socket (re)connects, not just when the channel changes — `socket.send`
	// drops messages silently while the WebSocket isn't open yet, and the
	// channel mounts well before the socket finishes its async handshake, so
	// a channelUri-only effect would lose the very first "view" of a session.
	createEffect(() => {
		const uri = channelUri();
		const isConnected = socket.connected();
		if (!uri || !isConnected) return;
		socket.send({ type: "view", data: { channel: uri } });
		localStorage.setItem(
			`${communityUriToUrlCompatible(community().community.uri as AT_URI<"social.colibri.community">)}:last-viewed`,
			JSON.stringify({ type: props.channel()!.type, uri }),
		);
	});

	const socketCleanup = socket.onEvent((event) => {
		if (event.type === "message_event") {
			const d = event.data;
			if (!d) return;
			if (d.channel && d.channel !== channelUri()) return;

			if (d.event === "delete") {
				removeMessage(d.uri);
				return;
			}

			// Already have this message. A pending row shares the deterministic
			// URI we assigned at send time — confirm it. Otherwise it's an edit
			// from elsewhere (or an already-confirmed message) — apply the text.
			const existing = messages().find((m) => m.uri === d.uri);
			if (existing) {
				if ("hash" in existing) {
					confirmPendingMessage((existing as PendingMessage).hash, d.uri);
				} else {
					updateMessageText(d.uri, d.text, d.facets ?? [], d.edited ?? false);
				}
				return;
			}

			// Fallback for any pending row without a URI match (e.g. legacy): our
			// own message echoed back, matched by text + channel.
			if (d.author.did === user.did) {
				const pending = messages().find(
					(m) => "hash" in m && m.text === d.text && m.channel === d.channel,
				) as PendingMessage | undefined;
				if (pending) confirmPendingMessage(pending.hash, d.uri);
				return;
			}

			// New message from another user — author is fully hydrated on the event.
			const parentMsg = d.parent
				? (messages().find((m) => m.uri === d.parent) as
						| Omit<Message, "parent">
						| undefined)
				: undefined;

			const newMsg: Message = {
				uri: d.uri,
				text: d.text,
				facets: d.facets ?? [],
				channel: d.channel,
				community: community().community.uri,
				author: d.author,
				parent: parentMsg,
				attachments: d.attachments ?? [],
				reactions: [],
				createdAt: d.createdAt,
				edited: d.edited ?? false,
			};

			const placement = placeMessage(messages(), newMsg, {
				hasMore: hasMore(),
			});
			if (placement.kind === "drop") return;

			batch(() => {
				if (placement.kind === "append") {
					setMessages((prev) => [...prev, newMsg]);
					if (d.live !== false) setNewIncomingMessage((n) => n + 1);
				} else {
					setMessages((prev) => insertAt(prev, newMsg, placement.index));
				}
			});
		} else if (event.type === "reaction_event") {
			const d = event.data;
			if (!d) return;
			const reactorDid = AtURI.parseAtURI(d.uri).did;

			if (d.event === "added") {
				if (!d.target || !d.emoji) return;
				if (d.channel && d.channel !== channelUri()) return;
				addReactionOptimistic(d.target, d.emoji, reactorDid);
			} else {
				// `removed` now carries emoji + target; the guard is a harmless
				// fallback for the rare cache-miss case where they're absent.
				if (!d.target || !d.emoji) return;
				if (d.channel && d.channel !== channelUri()) return;
				removeReactionOptimistic(d.target, d.emoji, reactorDid);
			}
		} else if (event.type === "typing_event") {
			const d = event.data;
			if (!d) return;
			if (d.channel !== channelUri()) return;
			if (d.did === user.did) return; // never show ourselves typing
			if (d.event === "start") addTyping(d.did);
			else removeTyping(d.did);
		}
	});

	const outboxCleanup = onOutboxSent(({ uri, collection }) => {
		if (collection !== "social.colibri.message") return;
		const pending = messages().find((m) => m.uri === uri && "hash" in m) as
			| PendingMessage
			| undefined;
		if (pending) confirmPendingMessage(pending.hash, uri);
	});

	const catchUp = async (): Promise<void> => {
		const uri = channelUri();
		if (!uri || initialLoading() || inflight) return;
		if (Date.now() - lastViewAt < CATCHUP_MIN_INTERVAL_MS) return;

		inflight = true;
		try {
			const prunable = new Set(messages().map((m) => m.uri));

			const view = await user.xrpc.social.colibri.channel.getChannelView(
				uri,
				PAGE_SIZE,
			);

			if (uri !== channelUri()) return;
			if (!view.ok) {
				log.warn("catchUp could not reach the channel", {
					code: view.error.code,
				});
				return;
			}

			const channel = view.data;
			const ordered = [...(channel?.messages ?? [])].reverse();
			const existingUris = new Set(messages().map((m) => m.uri));
			const novel = ordered.filter((m) => !existingUris.has(m.uri));
			const reconciled = reconcileFetchedWindow(messages(), ordered, {
				pageSize: PAGE_SIZE,
				prunable,
			});

			const spansWholeHistory = ordered.length < PAGE_SIZE;
			const kept = reconciled ?? messages();
			let merged = kept;
			let appended = false;
			for (const message of novel) {
				const placement = placeMessage(merged, message, {
					hasMore: spansWholeHistory ? false : hasMore(),
				});
				if (placement.kind === "drop") continue;
				if (placement.kind === "append") {
					merged = [...merged, message];
					appended = true;
				} else {
					merged = insertAt(merged, message, placement.index);
				}
			}

			batch(() => {
				if (merged !== messages()) setMessages(merged);
				if (appended) setNewIncomingMessage((n) => n + 1);
				if (spansWholeHistory) {
					const oldest = ordered[0];
					if (oldest) setCursor(rkeyOf(oldest.uri));
					setHasMore(false);
				}
				setReadCursorUri(channel?.readCursor?.cursor);
				setInitialUnseen(
					(channel?.unseen ?? []).map((n) => ({
						uri: n.messageUri,
						isPing: isPingKind(n.kind),
					})),
				);
				setHydratedFromNetwork(true);
			});
			lastViewAt = Date.now();
		} catch (err) {
			log.error("catchUp failed", {
				code: classifyThrown(err).code,
			});
		} finally {
			inflight = false;
		}
	};

	createEffect(
		on(
			() => socket.connected(),
			(isConnected) => {
				if (isConnected) void catchUp();
			},
		),
	);

	const onVisible = () => {
		if (document.visibilityState === "visible") void catchUp();
	};
	const onFocus = () => void catchUp();

	onMount(() => {
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("focus", onFocus);
	});

	onCleanup(() => {
		socketCleanup();
		outboxCleanup();
		document.removeEventListener("visibilitychange", onVisible);
		window.removeEventListener("focus", onFocus);
		typingTimers.forEach((t) => {
			clearTimeout(t);
		});
		typingTimers.clear();
	});

	// ---------------------------------------------------------------------------
	// Unread markers
	// ---------------------------------------------------------------------------

	/**
	 * Clears the on-screen unread boundary (the "New messages" divider).
	 */
	const clearUnreadBoundary = () => setReadCursorUri(undefined);

	let lastWrittenCursor: string | undefined;
	createEffect(
		on(channelUri, () => {
			lastWrittenCursor = undefined;
		}),
	);

	const messageRkey = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

	const advanceReadCursor = (explicitUri?: string) => {
		const uri = channelUri();
		if (!uri) return;

		let newest = explicitUri;
		if (!newest) {
			// Newest confirmed (non-pending) message. Pending rows now carry a
			// deterministic `at://` URI too, so detect them by the `hash` flag.
			const msgs = messages();
			for (let i = msgs.length - 1; i >= 0; i--) {
				const m = msgs[i];
				if (m && !("hash" in m) && m.uri.startsWith("at://")) {
					newest = m.uri;
					break;
				}
			}
		}

		if (!newest || newest === lastWrittenCursor) return;
		if (
			lastWrittenCursor &&
			messageRkey(newest) <= messageRkey(lastWrittenCursor)
		) {
			return;
		}
		lastWrittenCursor = newest;
		void writeReadCursor(user.did, uri, newest).catch(() => {
			if (lastWrittenCursor === newest) lastWrittenCursor = undefined;
		});
	};

	const value: ChannelContextValue = {
		data: () => props.channel(),
		channelUri,
		messages,
		hasMore,
		loadingOlder,
		initialLoading,
		error,
		loadOlder,
		snapshotAge,
		hydratedFromNetwork,
		replyingTo,
		setReplyingTo,
		clearReplyingTo,
		editingMessage,
		setEditingMessage,
		clearEditingMessage,
		submitMessageEdit,
		cancelMessageEdit,
		emptyEditPendingDeletion,
		clearEmptyEditPendingDeletion,
		focusedMessage,
		jumpToMessage,
		addPendingMessage,
		confirmPendingMessage,
		removePendingMessage,
		removeMessage,
		updateMessageText,
		addReactionOptimistic,
		removeReactionOptimistic,
		cacheReactionRkey,
		getReactionRkey,
		typingUsers,
		sendTyping,
		newIncomingMessage,
		outgoingMessage,
		readCursorUri,
		readCursorResolved,
		initialUnseen,
		advanceReadCursor,
		clearUnreadBoundary,
	};

	return (
		<ChannelContext.Provider value={value}>
			{props.children}
		</ChannelContext.Provider>
	);
};

export const useChannelContext = (): ChannelContextValue => {
	const ctx = useContext(ChannelContext);

	if (!ctx) {
		throw new Error("Unable to get channel context.");
	}

	return ctx;
};
