import {
	type Accessor,
	batch,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import type { Channel } from "../atproto/xrpc/social/colibri/community/listChannels";
import type {
	Message,
	PendingMessage,
} from "../atproto/xrpc/social/colibri/channel/listMessages";
import type { ColibriRichTextFacet } from "lib";
import { AtURI } from "../utils/at-uri";
import { useUserContext } from "./User";
import { useSocketContext } from "./Socket";
import { useCommunityContext } from "./Community";

/**
 * How long a typing indicator stays active without a refreshing `start`
 * event before it auto-clears, in ms. A safety net in case a `stop` event
 * is dropped.
 */
const TYPING_HOLD_MS = 5000;

const PAGE_SIZE = 50;

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

export type ChannelContextValue = {
	/**
	 * The full channel record (name, type, uri, category…) filtered out of
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
	error: Accessor<unknown>;
	loadOlder: () => Promise<void>;

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

	/**
	 * The URI of the message that should be scrolled into view + highlighted.
	 * Auto-clears after `FOCUS_HOLD_MS`. Set via `jumpToMessage`, never via
	 * a direct setter — the auto-clear is part of the contract.
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
	 * URI of the last message the current user has read in this channel.
	 * Messages after this URI are "new" and a divider is shown above them.
	 * `undefined` when there is no unread boundary (user is up-to-date).
	 */
	readCursorUri: Accessor<string | undefined>;

	/**
	 * Clears the unread divider and calls `updateSeen` on the notification
	 * service. Call when the user has scrolled to the bottom of the channel.
	 */
	markSeen: () => void;
};

export const ChannelContext = createContext<ChannelContextValue>();

const rkeyOf = (uri: string): string => uri.split("/").pop() ?? "";

export const ChannelContextProvider: ParentComponent<{
	channel: Accessor<Channel | undefined>;
}> = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const community = useCommunityContext();

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
	const [error, setError] = createSignal<unknown>(undefined);

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

	const reset = () => {
		inflight = false;
		reactionRkeyCache.clear();
		batch(() => {
			setMessages([]);
			setCursor(undefined);
			setHasMore(true);
			setLoadingOlder(false);
			setInitialLoading(true);
			setError(undefined);
		});
	};

	const loadOlder = async (): Promise<void> => {
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

			if (!res) {
				setError(new Error("Failed to fetch messages."));
				return;
			}

			const fetched = res.messages ?? [];

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

			batch(() => {
				setMessages((prev) => [...novel, ...prev]);
				const newOldest = novel[0] ?? olderChunk[0];
				if (newOldest) setCursor(rkeyOf(newOldest.uri));
				if (hitTop) setHasMore(false);
			});
		} catch (err) {
			console.error("[ChannelContext] loadOlder failed:", err);
			setError(err);
		} finally {
			inflight = false;
			batch(() => {
				setLoadingOlder(false);
				setInitialLoading(false);
			});
		}
	};

	// Reset state and seed the first page whenever the channel URI changes
	// (including the initial mount). `on` makes the dependency explicit.
	createEffect(
		on(channelUri, (uri) => {
			if (!uri) return;
			reset();
			loadOlder();
		}),
	);

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
		console.log("test1");
		setMessages((prev) => [...prev, msg]);
		console.log("test2");
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
		setMessages((prev) => prev.filter((m) => m.uri !== uri));
	};

	const updateMessageText = (
		uri: string,
		text: string,
		facets: ColibriRichTextFacet[],
	) => {
		setMessages((prev) =>
			prev.map((m) =>
				m.uri === uri ? { ...m, text, facets, edited: true } : m,
			),
		);
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
			typingTimers.forEach((t) => clearTimeout(t));
			typingTimers.clear();
			setTypingUsers([]);
		}),
	);

	// ---------------------------------------------------------------------------
	// Real-time: incoming socket events
	// ---------------------------------------------------------------------------

	const [newIncomingMessage, setNewIncomingMessage] = createSignal(0);

	// Inform the AppView which channel the user is viewing (drives typing-event
	// fan-out and read tracking on the server side).
	createEffect(
		on(channelUri, (uri) => {
			if (!uri) return;
			socket.send({ type: "view", data: { channel: uri } });
		}),
	);

	const socketCleanup = socket.onEvent((event) => {
		if (event.type === "message_event") {
			const d = event.data;
			if (!d) return;
			if (d.channel !== channelUri()) return;

			if (d.event === "delete") {
				removeMessage(d.uri);
				return;
			}

			// Already have this message (edit from elsewhere, or our own message
			// already confirmed) — apply the new text/facets.
			if (messages().some((m) => m.uri === d.uri)) {
				updateMessageText(d.uri, d.text, d.facets ?? []);
				return;
			}

			// Our own message arriving via socket before `createRecord` resolved:
			// match it to a pending row by text + channel and confirm it.
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

			setMessages((prev) => [...prev, newMsg]);
			setNewIncomingMessage((n) => n + 1);
		} else if (event.type === "reaction_event") {
			const d = event.data;
			if (!d) return;
			const reactorDid = AtURI.parseAtURI(d.uri).did;
			// We already applied our own reactions optimistically.
			if (reactorDid === user.did) return;

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

	onCleanup(() => {
		socketCleanup();
		typingTimers.forEach((t) => clearTimeout(t));
		typingTimers.clear();
	});

	// ---------------------------------------------------------------------------
	// Unread markers
	// ---------------------------------------------------------------------------

	const [readCursorUri, setReadCursorUri] = createSignal<string | undefined>(
		undefined,
	);

	// Fetch the read cursor whenever the channel changes, in parallel with the
	// first message page. Silently ignored if the AppView returns nothing.
	createEffect(
		on(channelUri, async (uri) => {
			setReadCursorUri(undefined);
			if (!uri) return;
			try {
				const res = await user.xrpc.social.colibri.channel.getReadCursor(uri);
				if (res?.cursor) setReadCursorUri(res.cursor);
			} catch {
				// Not fatal — just means no unread boundary.
			}
		}),
	);

	const markSeen = () => {
		setReadCursorUri(undefined);
		user.xrpc.social.colibri.notification.updateSeen().catch(() => {});
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
		replyingTo,
		setReplyingTo,
		clearReplyingTo,
		editingMessage,
		setEditingMessage,
		clearEditingMessage,
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
		readCursorUri,
		markSeen,
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
