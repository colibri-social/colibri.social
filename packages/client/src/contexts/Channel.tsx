import type { ColibriRichTextFacet } from "@colibri-social/lib";
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
	belongsToChannel,
	buildMessagesSnapshot,
	isSnapshotPaintable,
	reconcileFetchedWindow,
	refOf,
	restoreMessagesSnapshot,
	sameRecord,
	shouldWriteSnapshot,
	snapshotAgeMs,
	snapshotBelongsTo,
} from "../atproto/cache/messages-snapshot";
import {
	offerSnapshotWindow,
	registerOpenChannel,
} from "../atproto/cache/messages-writer";
import type { MessagesSnapshot, PendingMessage } from "../atproto/cache/schema";
import {
	createSnapshotScheduler,
	realSnapshotClock,
} from "../atproto/cache/snapshot-scheduler";
import {
	cacheEnabled,
	deleteMessages,
	readMessages,
	writeMessages,
} from "../atproto/cache/store";
import { takeChannelMessages } from "../atproto/channel-prefetch";
import {
	asAtUri,
	asDatetime,
	asSpaceRef,
	asUri,
	COLLECTIONS,
	colibri,
} from "../atproto/lexicons";
import { buildMessageRecord } from "../atproto/message-record";
import {
	enqueueSpaceCreate,
	enqueueSpaceDelete,
	enqueueSpacePut,
	onOutboxSent,
	outboxRevision,
	queuedRecords,
} from "../atproto/outbox/outbox";
import {
	messageUriFor,
	rehydrateQueuedMessages,
} from "../atproto/outbox/rehydrate";
import { nextTid } from "../atproto/outbox/tid";
import { recordRead } from "../atproto/read-cursor";
import { spaceSkey } from "../atproto/space-ref";
import type {
	LabelEventFrame,
	MessageEventFrame,
	ReactionEventFrame,
	TypingEventFrame,
} from "../atproto/sync-frames";
import { typingFrame, viewChannelFrame } from "../atproto/sync-frames";
import type {
	AttachmentView,
	ChannelView,
	Facet,
	MessageAttachment,
	MessageRecord,
	MessageView,
	RecordRef,
} from "../atproto/views";
import { clientForManagingApp } from "../atproto/xrpc";
import { trimWithFacets } from "../components/app/common/rich-text-renderer/util";
import { classifyThrown } from "../errors/classify";
import type { ColibriError } from "../errors/error";
import { isPingKind } from "../notifications";
import { getAppViewDid } from "../utils/appview";
import { clearEditDraft } from "../utils/composer-drafts";
import { createLogger } from "../utils/logger";
import { foldLabelEvent } from "../utils/message-labels";
import { insertAt, placeMessage } from "../utils/message-order";
import { asVisibleParent } from "../utils/message-parent";
import { markBoot } from "../utils/perf";
import { purify } from "../utils/purify";
import { recordSpeakers } from "../utils/recent-speakers";
import { probe, shortUri } from "../utils/switch-probe";
import { useCommunityContext, usePermissions } from "./Community";
import { createLoadSessions } from "./load-session";
import { profileViewOf } from "./profile-view";
import { useSocketContext } from "./Socket";
import { useUserContext } from "./User";

const TYPING_HOLD_MS = 5000;

export const PAGE_SIZE = 50;

const CACHE_WRITE_MAX_INTERVAL_MS = 5000;

const CACHE_WRITE_DEBOUNCE_MS = 400;

const CATCHUP_MIN_INTERVAL_MS = 1500;

const FOCUS_HOLD_MS = 2000;

const JUMP_FETCH_CAP = 50;

const MAX_UNREAD_STATUSES = 100;

type Did = RecordRef["did"];

export type UnseenEntry = {
	uri: MessageView["uri"];
	isPing: boolean;
};

export type LoadOlderHooks = {
	prepare?: (messages: Array<MessageView>) => Promise<void>;
	onBeforePrepend?: () => void;
	onAfterPrepend?: () => void;
};

export type SendMessageAttachment = {
	record: MessageAttachment;
	preview: AttachmentView;
};

export type SendMessageInput = {
	text: string;
	facets?: ReadonlyArray<ColibriRichTextFacet>;
	parent?: MessageView;
	attachments?: ReadonlyArray<SendMessageAttachment>;
	suppressedEmbeds?: ReadonlyArray<string>;
};

export type MessageRecordPatch = {
	text?: string;
	facets?: ReadonlyArray<ColibriRichTextFacet>;
	suppressedEmbeds?: ReadonlyArray<string>;
	updatedAt?: string;
};

export type ChannelContextValue = {
	data: Accessor<ChannelView | undefined>;

	linkEmbedsEnabled: Accessor<boolean>;
	canSendMessages: Accessor<boolean>;
	channelSpace: Accessor<string>;
	messages: Accessor<(MessageView | PendingMessage)[]>;
	hasMore: Accessor<boolean>;
	loadingOlder: Accessor<boolean>;
	initialLoading: Accessor<boolean>;
	error: Accessor<ColibriError | undefined>;
	loadOlder: (hooks?: LoadOlderHooks) => Promise<void>;

	snapshotAge: Accessor<number | undefined>;
	hydratedFromNetwork: Accessor<boolean>;

	replyingTo: Accessor<MessageView | undefined>;
	setReplyingTo: (message: MessageView) => void;
	clearReplyingTo: () => void;

	editingMessage: Accessor<MessageView | undefined>;
	setEditingMessage: (message: MessageView) => void;
	clearEditingMessage: () => void;
	submitMessageEdit: (
		text: string,
		facets: ColibriRichTextFacet[],
	) => Promise<boolean>;
	cancelMessageEdit: () => void;
	emptyEditPendingDeletion: Accessor<MessageView | undefined>;
	clearEmptyEditPendingDeletion: () => void;

	focusedMessage: Accessor<string | undefined>;
	jumpToMessage: (uri: string) => Promise<void>;

	sendMessage: (input: SendMessageInput) => Promise<void>;
	deleteMessage: (target: MessageView) => Promise<void>;
	patchMessageRecord: (
		target: MessageView,
		patch: MessageRecordPatch,
	) => Promise<boolean>;

	addPendingMessage: (msg: PendingMessage) => void;
	confirmPendingMessage: (hash: string, confirmed: MessageView) => void;
	removePendingMessage: (hash: string) => void;
	removeMessage: (uri: string) => void;
	updateMessageText: (
		uri: string,
		text: string,
		facets: ColibriRichTextFacet[],
		updatedAt: string,
	) => void;

	patchMessage: (uri: string, patch: Partial<MessageView>) => void;

	addReactionOptimistic: (
		target: RecordRef,
		emoji: string,
		reactorDid: Did,
	) => void;
	removeReactionOptimistic: (
		target: RecordRef,
		emoji: string,
		reactorDid: Did,
	) => void;

	cacheReactionRkey: (target: RecordRef, emoji: string, rkey: string) => void;
	getReactionRkey: (target: RecordRef, emoji: string) => string | undefined;

	typingUsers: Accessor<string[]>;
	sendTyping: () => void;
	newIncomingMessage: Accessor<number>;
	outgoingMessage: Accessor<number>;

	unreadCursor: Accessor<string | undefined>;
	unreadCursorResolved: Accessor<boolean>;
	initialUnseen: Accessor<UnseenEntry[]>;
	advanceReadCursor: (explicitRkey?: string) => void;
	clearUnreadBoundary: () => void;
};

const log = createLogger("channel");

export const ChannelContext = createContext<ChannelContextValue>();

export const ChannelContextProvider: ParentComponent<{
	channel: Accessor<ChannelView | undefined>;
}> = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const community = useCommunityContext();
	const { canApplyLabel } = usePermissions();

	const ns = () => namespace(getAppViewDid(), user.did);
	const communityDid = () => community().community.did;
	const managingClient = () =>
		clientForManagingApp(user.atproto.agent, community().community.managingApp);

	const channelSpace = createMemo(() => props.channel()?.space ?? "");

	const linkEmbedsEnabled = createMemo(
		() =>
			props.channel()?.linkEmbeds ?? community().community.linkEmbeds ?? true,
	);

	const canSendMessages = createMemo(
		() => props.channel()?.viewer.canPost ?? false,
	);

	const [messages, setMessages] = createSignal<
		(MessageView | PendingMessage)[]
	>([]);
	const reactionRkeyCache = new Map<string, Map<string, string>>();
	const refKey = (ref: RecordRef) => `${ref.did}:${ref.rkey}`;

	const [cursor, setCursor] = createSignal<string | undefined>(undefined);
	const [hasMore, setHasMore] = createSignal(true);
	const [loadingOlder, setLoadingOlder] = createSignal(false);
	const [initialLoading, setInitialLoading] = createSignal(true);
	const [error, setError] = createSignal<ColibriError | undefined>(undefined);
	const [unreadCursor, setUnreadCursor] = createSignal<string | undefined>(
		undefined,
	);
	const [unreadCursorResolved, setUnreadCursorResolved] = createSignal(false);
	const [initialUnseen, setInitialUnseen] = createSignal<UnseenEntry[]>([]);
	const [snapshotAge, setSnapshotAge] = createSignal<number | undefined>(
		undefined,
	);
	const [hydratedFromNetwork, setHydratedFromNetwork] = createSignal(false);
	const [appliedRemoval, setAppliedRemoval] = createSignal(false);
	let paintedAt: number | undefined;

	const [replyingTo, setReplyingTo] = createSignal<MessageView | undefined>(
		undefined,
		{ equals: false },
	);
	const [editingMessage, setEditingMessage] = createSignal<
		MessageView | undefined
	>(undefined, { equals: false });
	const [emptyEditPendingDeletion, setEmptyEditPendingDeletion] = createSignal<
		MessageView | undefined
	>(undefined, { equals: false });
	const clearEmptyEditPendingDeletion = () =>
		setEmptyEditPendingDeletion(undefined);
	const [focusedMessage, setFocusedMessage] = createSignal<string | undefined>(
		undefined,
		{ equals: false },
	);

	let focusClearTimer: ReturnType<typeof setTimeout> | undefined;

	const sessions = createLoadSessions<{ busy: boolean; lastViewAt: number }>(
		() => ({ busy: false, lastViewAt: 0 }),
	);

	const reset = () => {
		paintedAt = undefined;
		reactionRkeyCache.clear();
		batch(() => {
			setMessages([]);
			setCursor(undefined);
			setHasMore(true);
			setLoadingOlder(false);
			setInitialLoading(true);
			setError(undefined);
			setUnreadCursor(undefined);
			setUnreadCursorResolved(false);
			setInitialUnseen([]);
			setSnapshotAge(undefined);
			setHydratedFromNetwork(false);
			setAppliedRemoval(false);
		});
	};

	const resetComposerTargets = () => {
		batch(() => {
			if (replyingTo()) setReplyingTo(undefined);
			if (editingMessage()) setEditingMessage(undefined);
			if (emptyEditPendingDeletion()) setEmptyEditPendingDeletion(undefined);
		});
	};

	const fetchUnreadCursor = async (
		space: string,
		signal: AbortSignal,
	): Promise<string | undefined> => {
		const did = communityDid();
		if (!did) return undefined;
		const res = await managingClient().call(
			colibri.channel.listUnreadStatus.main,
			{ params: { community: did, limit: MAX_UNREAD_STATUSES } },
			{ signal },
		);
		if (!res.ok) return undefined;
		return res.data.statuses.find((s) => s.channel === space)?.cursor;
	};

	const fetchUnseen = async (
		space: string,
		signal: AbortSignal,
	): Promise<UnseenEntry[]> => {
		const res = await user.xrpc.call(
			colibri.notification.getUnseen.main,
			{ params: { channel: space, limit: MAX_UNREAD_STATUSES } },
			{ signal },
		);
		if (!res.ok) return [];
		return res.data.notifications.flatMap((n) =>
			n.message ? [{ uri: n.message.uri, isPing: isPingKind(n.kind) }] : [],
		);
	};

	const loadOlder = async (hooks?: LoadOlderHooks): Promise<void> => {
		const session = sessions.current();
		if (!session || session.state.busy) return;
		if (!hasMore()) return;
		const space = channelSpace();
		if (!space) return;

		session.state.busy = true;
		setLoadingOlder(true);
		try {
			const res = await managingClient().call(
				colibri.channel.listMessages.main,
				{ params: { channel: space, limit: PAGE_SIZE, cursor: cursor() } },
				{ signal: session.supersededSignal },
			);

			if (!sessions.isCurrent(session)) return;

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

			const olderChunk = [...fetched].reverse();
			const existingUris = new Set(messages().map((m) => m.uri));
			const novel = olderChunk.filter((m) => !existingUris.has(m.uri));
			const hitTop = fetched.length < PAGE_SIZE;

			if (hooks?.prepare) await hooks.prepare(novel);
			if (!sessions.isCurrent(session)) return;

			hooks?.onBeforePrepend?.();
			batch(() => {
				setMessages((prev) => [...novel, ...prev]);
				const newOldest = olderChunk[0];
				if (newOldest) setCursor(newOldest.rkey);
				if (hitTop) setHasMore(false);
			});
			hooks?.onAfterPrepend?.();
		} catch (err) {
			const failure = classifyThrown(err, { method: "channel.listMessages" });
			log.error("loadOlder failed", { code: failure.code });
			if (sessions.isCurrent(session)) setError(failure);
		} finally {
			session.state.busy = false;
			if (sessions.isCurrent(session)) {
				batch(() => {
					setLoadingOlder(false);
					setInitialLoading(false);
				});
			}
		}
	};

	const loadInitial = async (): Promise<void> => {
		const session = sessions.current();
		if (!session) return;
		const space = channelSpace();
		if (!space) return;

		session.state.busy = true;
		setLoadingOlder(true);

		try {
			const primed = takeChannelMessages(space);
			if (primed) markBoot("prefetch:consumed");
			const result =
				(await primed) ??
				(await managingClient().call(
					colibri.channel.listMessages.main,
					{ params: { channel: space, limit: PAGE_SIZE } },
					{ signal: sessions.teardownSignal },
				));

			if (!result.ok) {
				if (sessions.isCurrent(session)) setError(result.error);
				return;
			}

			const ordered = [...(result.data?.messages ?? [])].reverse();

			if (!sessions.isCurrent(session)) {
				probe("loadInitial: diverted to cache", {
					wasFor: shortUri(session.key),
					rows: ordered.length,
				});
				offerSnapshotWindow(session.key, ordered, {
					readCursor: undefined,
					hasMore: ordered.length >= PAGE_SIZE,
					limit: PAGE_SIZE,
				});
				return;
			}

			probe("loadInitial: applied", {
				channel: shortUri(space),
				viewBelongsTo: shortUri(ordered[0]?.channel),
				rows: ordered.length,
			});

			const stillPending = messages().filter(
				(m) => "hash" in m && !ordered.some((o) => o.uri === m.uri),
			);

			batch(() => {
				setError(undefined);
				setMessages([...ordered, ...stillPending]);
				const oldest = ordered[0];
				if (oldest) setCursor(oldest.rkey);
				setHasMore(ordered.length >= PAGE_SIZE);
				setHydratedFromNetwork(true);
			});
			session.state.lastViewAt = Date.now();

			const [readCursor, unseen] = await Promise.all([
				fetchUnreadCursor(space, sessions.teardownSignal),
				fetchUnseen(space, sessions.teardownSignal),
			]);
			if (sessions.isCurrent(session)) {
				batch(() => {
					setUnreadCursor(readCursor);
					setInitialUnseen(unseen);
				});
			}
		} catch (err) {
			const failure = classifyThrown(err, { method: "channel.listMessages" });
			log.error("loadInitial failed", { code: failure.code });
			if (sessions.isCurrent(session)) setError(failure);
		} finally {
			session.state.busy = false;
			if (sessions.isCurrent(session)) {
				batch(() => {
					setLoadingOlder(false);
					setInitialLoading(false);
				});
				setUnreadCursorResolved(true);
			}
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

	createEffect(
		on(channelSpace, (space) => {
			probe("channelSpace changed", {
				to: shortUri(space),
				listBelongsTo: shortUri(messages()[0]?.channel),
				rows: messages().length,
			});
			flushSnapshot();
			resetComposerTargets();
			registerOpenChannel(space);
			if (!space) {
				probe("channel went away, resetting", {
					listBelongsTo: shortUri(messages()[0]?.channel),
					rows: messages().length,
				});
				sessions.abortCurrent();
				reset();
				return;
			}
			sessions.begin(space);
			reset();
			probe("reset done", { rows: messages().length });
			loadInitial();
		}),
	);
	onCleanup(() => {
		sessions.dispose();
		registerOpenChannel(undefined);
	});

	let scannedMessages: (MessageView | PendingMessage)[] | undefined;

	createEffect(() => {
		const current = messages();
		if (current === scannedMessages) return;
		scannedMessages = current;
		recordSpeakers(communityDid() ?? "", current);
	});

	createEffect(() => {
		if (!initialLoading()) markBoot("channel:firstPage");
	});

	createEffect(
		on(channelSpace, async (space) => {
			if (!cacheEnabled() || !space) return;
			const session = sessions.current();
			if (!session) return;
			const cached = await readMessages(ns(), space);
			if (!cached) {
				probe("paint: nothing stored", { channel: shortUri(space) });
				return;
			}
			if (!snapshotBelongsTo(cached, space)) {
				log.warn("discarded a cached snapshot that belongs elsewhere", {
					channel: shortUri(space),
					stored: shortUri(cached.messages[0]?.channel ?? ""),
				});
				void deleteMessages(ns(), space);
				return;
			}
			const age = snapshotAgeMs(cached, Date.now());
			if (!isSnapshotPaintable(age)) return;
			if (!sessions.isCurrent(session) || session.key !== space) {
				probe("paint: superseded", { channel: shortUri(space) });
				return;
			}
			if (hydratedFromNetwork()) return;
			if (messages().length > 0) {
				probe("paint: BLOCKED by existing rows", {
					channel: shortUri(space),
					listBelongsTo: shortUri(messages()[0]?.channel),
					rows: messages().length,
				});
				return;
			}
			probe("paint applied", {
				channel: shortUri(space),
				snapshotBelongsTo: shortUri(cached.messages[0]?.channel),
				rows: cached.messages.length,
				ageMs: age,
			});
			const restored = restoreMessagesSnapshot(cached);
			paintedAt = cached.ts;
			batch(() => {
				setMessages(cached.messages);
				if (restored.cursor) setCursor(restored.cursor);
				if (restored.hasMore !== undefined) setHasMore(restored.hasMore);
				setUnreadCursor(cached.readCursor);
				setSnapshotAge(age);
				setInitialLoading(false);
				markBoot("cache:paint");
			});
		}),
	);

	createEffect(() => {
		const space = channelSpace();
		outboxRevision();
		if (!space || initialLoading()) return;
		untrack(() => {
			const reconciled = rehydrateQueuedMessages({
				channelSpace: space,
				author: profileViewOf(user),
				queued: queuedRecords(COLLECTIONS.message),
				existing: messages(),
			});
			if (reconciled) setMessages(reconciled);
		});
	});

	createEffect(() => {
		const space = channelSpace();
		const confirmed = messages().filter(
			(m): m is MessageView =>
				!("hash" in m) &&
				m.uri.startsWith("at://") &&
				belongsToChannel(m, space),
		);
		const hydrated = hydratedFromNetwork();
		const gate = {
			cacheEnabled: cacheEnabled(),
			channelUri: space,
			hydratedFromNetwork: hydrated,
			appliedRemoval: appliedRemoval(),
		};
		if (!shouldWriteSnapshot(gate)) return;
		snapshotWrites.schedule({
			ns: ns(),
			uri: space,
			snap: buildMessagesSnapshot(confirmed, {
				readCursor: unreadCursor(),
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
		const session = sessions.current();
		if (!session) return;

		let fetches = 0;
		while (
			fetches < JUMP_FETCH_CAP &&
			sessions.isCurrent(session) &&
			!messages().some((m) => m.uri === uri) &&
			hasMore()
		) {
			await loadOlder();
			fetches++;
		}

		if (!sessions.isCurrent(session)) return;

		if (focusClearTimer !== undefined) clearTimeout(focusClearTimer);
		setFocusedMessage(uri);
		focusClearTimer = setTimeout(() => {
			setFocusedMessage(undefined);
			focusClearTimer = undefined;
		}, FOCUS_HOLD_MS);
	};

	const addPendingMessage = (msg: PendingMessage) => {
		setMessages((prev) =>
			prev.some((m) => m.uri === msg.uri)
				? prev.map((m) => (m.uri === msg.uri ? msg : m))
				: [...prev, msg],
		);
		setOutgoingMessage((n) => n + 1);
	};

	const confirmPendingMessage = (hash: string, confirmed: MessageView) => {
		setMessages((prev) =>
			prev.map((m) => ("hash" in m && m.hash === hash ? confirmed : m)),
		);
	};

	const removePendingMessage = (hash: string) => {
		setMessages((prev) =>
			prev.filter((m) => !("hash" in m && m.hash === hash)),
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
		updatedAt: string,
	) => {
		const branded = asDatetime(updatedAt);
		setMessages((prev) =>
			prev.map((m) =>
				m.uri === uri
					? {
							...m,
							text,
							facets: facets as unknown as Facet[],
							updatedAt: branded,
						}
					: m,
			),
		);
	};

	const patchMessage = (uri: string, patch: Partial<MessageView>) => {
		setMessages((prev) =>
			prev.map((m) => (m.uri === uri ? { ...m, ...patch } : m)),
		);
	};

	const patchMessageRecord = async (
		target: MessageView,
		patch: MessageRecordPatch,
	): Promise<boolean> => {
		if (target.legacy) return false;
		const space = channelSpace();
		if (!space) return false;

		try {
			const current = await user.atproto.agent.com.atproto.space.getRecord({
				space,
				repo: user.did,
				collection: COLLECTIONS.message,
				rkey: target.rkey,
			});
			const existing = current.data.value as MessageRecord;
			const record: MessageRecord = {
				...existing,
				...(patch.text !== undefined ? { text: patch.text } : {}),
				...(patch.facets !== undefined
					? {
							facets:
								patch.facets.length > 0
									? (patch.facets as unknown as Facet[])
									: undefined,
						}
					: {}),
				...(patch.suppressedEmbeds !== undefined
					? {
							suppressedEmbeds:
								patch.suppressedEmbeds.length > 0
									? patch.suppressedEmbeds.map(asUri)
									: undefined,
						}
					: {}),
				...(patch.updatedAt !== undefined
					? { updatedAt: asDatetime(patch.updatedAt) }
					: {}),
			};
			await enqueueSpacePut(
				space,
				user.did,
				COLLECTIONS.message,
				target.rkey,
				record,
				{ label: "Failed to update message." },
			);
			return true;
		} catch (err) {
			log.error("patchMessageRecord failed", {
				code: classifyThrown(err, { method: "space.getRecord" }).code,
			});
			return false;
		}
	};

	const submitMessageEdit = async (
		text: string,
		facets: ColibriRichTextFacet[],
	): Promise<boolean> => {
		const target = editingMessage();
		if (!target) return false;

		const trimmed = trimWithFacets({ text, facets });
		const cleanText = purify(trimmed.text);
		const cleanFacets = trimmed.facets;

		if (cleanText.length === 0 && target.attachments.length === 0) {
			clearEditDraft(target.uri);
			clearEditingMessage();
			setEmptyEditPendingDeletion(target);
			return true;
		}

		const originalText = target.text;
		const originalFacets = target.facets;
		const originalUpdatedAt = target.updatedAt;
		const updatedAt = new Date().toISOString();

		updateMessageText(target.uri, cleanText, cleanFacets, updatedAt);
		clearEditDraft(target.uri);
		clearEditingMessage();

		const ok = await patchMessageRecord(target, {
			text: cleanText,
			facets: cleanFacets,
			updatedAt,
		});
		if (!ok) {
			patchMessage(target.uri, {
				text: originalText,
				facets: originalFacets,
				updatedAt: originalUpdatedAt,
			});
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

	const sendMessage = async (input: SendMessageInput): Promise<void> => {
		const space = channelSpace();
		if (!space) return;

		const rkey = nextTid();
		const createdAt = new Date().toISOString();
		const parentRef: RecordRef | undefined = input.parent
			? { did: input.parent.author.did, rkey: input.parent.rkey }
			: undefined;

		const record = buildMessageRecord({
			text: input.text,
			facets: input.facets as unknown as Facet[] | undefined,
			createdAt,
			parent: parentRef,
			attachments: input.attachments?.map((a) => a.record),
			suppressedEmbeds: input.suppressedEmbeds,
		});

		const pending: PendingMessage = {
			hash: `outbox:${rkey}`,
			uri: asAtUri(messageUriFor(user.did, rkey)),
			channel: asSpaceRef(space),
			author: profileViewOf(user),
			text: input.text,
			facets: (input.facets ?? []) as unknown as MessageView["facets"],
			attachments: (input.attachments ?? []).map((a) => a.preview),
			createdAt: asDatetime(createdAt),
			...(input.parent ? { parent: asVisibleParent(input.parent) } : {}),
		};

		addPendingMessage(pending);
		advanceReadCursor(rkey);

		try {
			await enqueueSpaceCreate(space, user.did, COLLECTIONS.message, record, {
				rkey,
				label: "Failed to send message.",
			});
		} catch {
			removePendingMessage(pending.hash);
			toast.error("Failed to send message.");
		}
	};

	const deleteMessage = async (target: MessageView): Promise<void> => {
		if (target.legacy) return;
		const space = channelSpace();
		if (!space) return;
		removeMessage(target.uri);
		try {
			await enqueueSpaceDelete(
				space,
				user.did,
				COLLECTIONS.message,
				target.rkey,
				{
					label: "Failed to delete message.",
				},
			);
		} catch {
			toast.error("Failed to delete message.");
		}
	};

	const addReactionOptimistic = (
		target: RecordRef,
		emoji: string,
		reactorDid: Did,
	) => {
		setMessages((prev) =>
			prev.map((m) => {
				if ("hash" in m || !sameRecord(m, target)) return m;
				const existing = m.reactions.find((r) => r.emoji === emoji);
				if (existing) {
					if (existing.reactors.includes(reactorDid)) return m;
					return {
						...m,
						reactions: m.reactions.map((r) =>
							r.emoji === emoji
								? {
										...r,
										count: r.count + 1,
										reactors: [...r.reactors, reactorDid],
										...(reactorDid === user.did ? { viewerReacted: true } : {}),
									}
								: r,
						),
					};
				}
				return {
					...m,
					reactions: [
						...m.reactions,
						{
							emoji,
							count: 1,
							reactors: [reactorDid],
							...(reactorDid === user.did ? { viewerReacted: true } : {}),
						},
					],
				};
			}),
		);
	};

	const removeReactionOptimistic = (
		target: RecordRef,
		emoji: string,
		reactorDid: Did,
	) => {
		setMessages((prev) =>
			prev.map((m) => {
				if ("hash" in m || !sameRecord(m, target)) return m;
				const existing = m.reactions.find((r) => r.emoji === emoji);
				if (!existing?.reactors.includes(reactorDid)) return m;
				return {
					...m,
					reactions: m.reactions
						.map((r) =>
							r.emoji === emoji
								? {
										...r,
										count: r.count - 1,
										reactors: r.reactors.filter((d) => d !== reactorDid),
										...(reactorDid === user.did
											? { viewerReacted: false }
											: {}),
									}
								: r,
						)
						.filter((r) => r.count > 0),
				};
			}),
		);
	};

	const cacheReactionRkey = (
		target: RecordRef,
		emoji: string,
		rkey: string,
	) => {
		const key = refKey(target);
		if (!reactionRkeyCache.has(key)) reactionRkeyCache.set(key, new Map());
		reactionRkeyCache.get(key)!.set(emoji, rkey);
	};

	const getReactionRkey = (
		target: RecordRef,
		emoji: string,
	): string | undefined => reactionRkeyCache.get(refKey(target))?.get(emoji);

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

	const sendTyping = () => {
		const space = channelSpace();
		if (!space) return;
		socket.send(typingFrame(space));
	};

	createEffect(
		on(channelSpace, () => {
			typingTimers.forEach((t) => {
				clearTimeout(t);
			});
			typingTimers.clear();
			setTypingUsers([]);
		}),
	);

	const [newIncomingMessage, setNewIncomingMessage] = createSignal(0);
	const [outgoingMessage, setOutgoingMessage] = createSignal(0);

	createEffect(() => {
		const space = channelSpace();
		const isConnected = socket.connected();
		if (!isConnected) return;
		socket.send(viewChannelFrame(space || undefined));
		const did = communityDid();
		const channel = props.channel();
		if (space && did && channel) {
			localStorage.setItem(
				`${did}:last-viewed`,
				JSON.stringify({ uri: space, type: channel.type }),
			);
		}
	});

	const handleMessageEvent = (event: MessageEventFrame) => {
		if (event.channel !== channelSpace()) return;

		if (event.event === "delete") {
			const subject = event.subject;
			if (!subject) return;
			const target = messages().find(
				(m) => !("hash" in m) && sameRecord(m, subject),
			);
			if (target) removeMessage(target.uri);
			return;
		}

		const incoming = event.message;
		if (!incoming) return;

		const pendingHash = `outbox:${incoming.rkey}`;
		const pending = messages().find(
			(m) => "hash" in m && m.hash === pendingHash,
		) as PendingMessage | undefined;
		if (pending) {
			confirmPendingMessage(pending.hash, incoming);
			return;
		}

		const existing = messages().find(
			(m) => !("hash" in m) && sameRecord(m, refOf(incoming)),
		);
		if (existing) {
			patchMessage(existing.uri, incoming);
			return;
		}

		if (event.event !== "create") return;

		const placement = placeMessage(messages(), incoming, {
			hasMore: hasMore(),
		});
		if (placement.kind === "drop") return;

		batch(() => {
			if (placement.kind === "append") {
				setMessages((prev) => [...prev, incoming]);
				setNewIncomingMessage((n) => n + 1);
			} else {
				setMessages((prev) => insertAt(prev, incoming, placement.index));
			}
		});
	};

	const handleReactionEvent = (event: ReactionEventFrame) => {
		if (event.channel !== channelSpace()) return;
		if (event.event === "create") {
			addReactionOptimistic(event.target, event.emoji, event.actor);
		} else {
			removeReactionOptimistic(event.target, event.emoji, event.actor);
		}
	};

	const handleLabelEvent = (event: LabelEventFrame) => {
		if (event.space !== channelSpace()) return;

		const target = messages().find(
			(m) =>
				!("hash" in m) &&
				m.author.did === event.subject.did &&
				m.rkey === event.subject.rkey,
		) as MessageView | undefined;
		if (!target) return;

		const fold = foldLabelEvent(
			target,
			event,
			{ did: user.did, canApplyLabel: canApplyLabel(user.did) },
			() => new Date().toISOString(),
		);

		if (fold.kind === "remove") {
			removeMessage(target.uri);
		} else if (fold.kind === "update") {
			patchMessage(target.uri, { labels: fold.labels });
		}
	};

	const handleTypingEvent = (event: TypingEventFrame) => {
		if (event.channel !== channelSpace()) return;
		if (event.did === user.did) return;
		addTyping(event.did);
	};

	const socketCleanup = socket.onEvent((event) => {
		switch (event.$type) {
			case "social.colibri.beta.sync.defs#messageEvent":
				handleMessageEvent(event);
				break;
			case "social.colibri.beta.sync.defs#reactionEvent":
				handleReactionEvent(event);
				break;
			case "social.colibri.beta.sync.defs#labelEvent":
				handleLabelEvent(event);
				break;
			case "social.colibri.beta.sync.defs#typingEvent":
				handleTypingEvent(event);
				break;
			default:
				break;
		}
	});

	const outboxCleanup = onOutboxSent(({ uri, collection }) => {
		if (collection !== COLLECTIONS.message) return;
		const rkey = uri.slice(uri.lastIndexOf("/") + 1);
		const hash = `outbox:${rkey}`;
		const pending = messages().find((m) => "hash" in m && m.hash === hash) as
			| PendingMessage
			| undefined;
		if (!pending) return;
		const { hash: _hash, ...rest } = pending;
		const confirmed: MessageView = { ...rest, rkey, reactions: [], labels: [] };
		setMessages((prev) => prev.map((m) => (m === pending ? confirmed : m)));
	});

	const catchUp = async (): Promise<void> => {
		const session = sessions.current();
		if (!session || session.state.busy) return;
		const space = channelSpace();
		if (!space || initialLoading()) return;
		if (Date.now() - session.state.lastViewAt < CATCHUP_MIN_INTERVAL_MS) return;

		session.state.busy = true;
		try {
			const prunable = new Set(messages().map((m) => m.uri));

			const result = await managingClient().call(
				colibri.channel.listMessages.main,
				{ params: { channel: space, limit: PAGE_SIZE } },
				{ signal: sessions.teardownSignal },
			);

			if (!result.ok) {
				log.warn("catchUp could not reach the channel", {
					code: result.error.code,
				});
				return;
			}

			const ordered = [...(result.data?.messages ?? [])].reverse();

			if (!sessions.isCurrent(session)) {
				offerSnapshotWindow(session.key, ordered, {
					readCursor: undefined,
					hasMore: ordered.length >= PAGE_SIZE,
					limit: PAGE_SIZE,
				});
				return;
			}

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
					if (oldest) setCursor(oldest.rkey);
					setHasMore(false);
				}
				setHydratedFromNetwork(true);
			});
			session.state.lastViewAt = Date.now();

			const [readCursor, unseen] = await Promise.all([
				fetchUnreadCursor(space, sessions.teardownSignal),
				fetchUnseen(space, sessions.teardownSignal),
			]);
			if (sessions.isCurrent(session)) {
				batch(() => {
					setUnreadCursor(readCursor);
					setInitialUnseen(unseen);
				});
			}
		} catch (err) {
			log.error("catchUp failed", {
				code: classifyThrown(err).code,
			});
		} finally {
			session.state.busy = false;
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

	const clearUnreadBoundary = () => setUnreadCursor(undefined);

	const advanceReadCursor = (explicitRkey?: string) => {
		const space = channelSpace();
		if (!space) return;
		const skey = spaceSkey(space);
		if (!skey) return;
		const did = communityDid();
		if (!did) return;

		let newest = explicitRkey;
		if (!newest) {
			const msgs = messages();
			for (let i = msgs.length - 1; i >= 0; i--) {
				const m = msgs[i];
				if (m && !("hash" in m)) {
					newest = m.rkey;
					break;
				}
			}
		}

		if (!newest) return;
		recordRead(did, skey, newest);
		setUnreadCursor((current) =>
			current === undefined || newest! > current ? newest : current,
		);
	};

	const value: ChannelContextValue = {
		data: () => props.channel(),
		linkEmbedsEnabled,
		canSendMessages,
		channelSpace,
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
		sendMessage,
		deleteMessage,
		patchMessageRecord,
		addPendingMessage,
		confirmPendingMessage,
		removePendingMessage,
		removeMessage,
		updateMessageText,
		patchMessage,
		addReactionOptimistic,
		removeReactionOptimistic,
		cacheReactionRkey,
		getReactionRkey,
		typingUsers,
		sendTyping,
		newIncomingMessage,
		outgoingMessage,
		unreadCursor,
		unreadCursorResolved,
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
