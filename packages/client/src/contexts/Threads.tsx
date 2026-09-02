import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	on,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import { namespace } from "../atproto/cache/keys";
import {
	createSnapshotScheduler,
	realSnapshotClock,
} from "../atproto/cache/snapshot-scheduler";
import {
	cacheEnabled,
	readThreads,
	writeThreads,
} from "../atproto/cache/store";
import {
	forgetThreadParent,
	rememberThreadParent,
} from "../atproto/colibri-channel-url";
import {
	asDatetime,
	asSpaceRef,
	COLLECTIONS,
	colibri,
	SELF,
} from "../atproto/lexicons";
import {
	enqueueSpaceCreate,
	enqueueSpaceDelete,
	onOutboxSent,
} from "../atproto/outbox/outbox";
import { frameIs } from "../atproto/sync-frames";
import type { MoveSubject } from "../atproto/thread-move";
import type { MessageView, SpaceRecordRef, ThreadView } from "../atproto/views";
import { clientForManagingApp } from "../atproto/xrpc";
import type { XrpcResult } from "../atproto/xrpc/result";
import { classifyThrown } from "../errors/classify";
import type { ColibriError } from "../errors/error";
import { showError } from "../errors/show-error";
import { getAppViewDid } from "../utils/appview";
import { createLogger } from "../utils/logger";
import { useCommunityContext } from "./Community";
import { useSocketContext } from "./Socket";
import {
	markThreadRead,
	removeThread,
	threadAnchoredAt,
	threadsInChannel,
	touchThread,
	upsertThread,
} from "./thread-list";
import { useUserContext } from "./User";

const log = createLogger("threads");

const PAGE_LIMIT = 100;

const MAX_PAGES = 10;

export type CreateThreadInput = {
	channel: string;
	name: string;
	anchor?: SpaceRecordRef;
	visibleToRoles?: Array<string>;
	visibleToMembers?: Array<string>;
};

export type ThreadDraft = {
	channel: string;
	anchor?: SpaceRecordRef;
	anchorMessage?: MessageView;
	suggestedName: string;
};

export type ThreadsContextValue = {
	draft: Accessor<ThreadDraft | undefined>;
	openDraft: (draft: ThreadDraft) => void;
	closeDraft: () => void;
	threads: Accessor<Array<ThreadView>>;
	loading: Accessor<boolean>;
	error: Accessor<ColibriError | undefined>;
	bySpace: (space: string) => ThreadView | undefined;
	inChannel: (channel: string) => Array<ThreadView>;
	anchoredAt: (
		channel: string,
		author: string,
		rkey: string,
	) => ThreadView | undefined;
	openThreadSpace: Accessor<string | undefined>;
	setOpenThreadSpace: (space: string | undefined) => void;
	openedAt: Accessor<Readonly<Record<string, number>>>;
	refresh: () => void;
	fetchThread: (space: string) => Promise<ThreadView | undefined>;
	createThread: (input: CreateThreadInput) => Promise<ThreadView | undefined>;
	renameThread: (space: string, name: string) => Promise<boolean>;
	setVisibility: (
		space: string,
		visibility: {
			visibleToRoles: Array<string>;
			visibleToMembers: Array<string>;
		},
	) => Promise<boolean>;
	repointThread: (
		space: string,
		channel: string,
		anchor?: SpaceRecordRef,
	) => Promise<boolean>;
	deleteThread: (space: string) => Promise<boolean>;
	followThread: (space: string) => Promise<void>;
	unfollowThread: (space: string) => Promise<void>;
	moveMessages: (input: {
		source: string;
		destination: string;
		subjects: ReadonlyArray<MoveSubject>;
	}) => Promise<boolean>;
	markRead: (space: string) => void;
};

const ThreadsContext = createContext<ThreadsContextValue>();

export const ThreadsContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const community = useCommunityContext();

	const [threads, setThreads] = createSignal<Array<ThreadView>>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal<ColibriError | undefined>(undefined);
	const [openThreadSpace, setOpenThreadSpace] = createSignal<
		string | undefined
	>(undefined);
	const [openedAt, setOpenedAt] = createSignal<Record<string, number>>({});
	const [reloads, setReloads] = createSignal(0);
	const [draft, setDraft] = createSignal<ThreadDraft | undefined>(undefined);
	const [hydrated, setHydrated] = createSignal(false);
	const locallyRead = new Set<string>();

	const communityDid = () => community().community.did;

	const ns = () => namespace(getAppViewDid(), user.did);

	const client = () =>
		clientForManagingApp(user.atproto.agent, community().community.managingApp);

	const fail = (result: { ok: false; error: ColibriError }): false => {
		showError(result.error, { report: false });
		return false;
	};

	const remember = (list: ReadonlyArray<ThreadView>) => {
		for (const thread of list)
			rememberThreadParent(thread.space, thread.channel);
	};

	const settle = (thread: ThreadView): ThreadView =>
		locallyRead.has(thread.space)
			? {
					...thread,
					viewer: { ...thread.viewer, hasUnread: false, unreadMentions: 0 },
				}
			: thread;

	const apply = (next: Array<ThreadView>) => {
		remember(next);
		setThreads(next.map(settle));
	};

	const snapshots = createSnapshotScheduler<
		{ did: string; list: Array<ThreadView> },
		ReturnType<typeof setTimeout>
	>({
		maxIntervalMs: 5_000,
		debounceMs: 500,
		clock: realSnapshotClock,
		write: ({ did, list }) => {
			void writeThreads(ns(), did, { threads: list, ts: Date.now() });
		},
	});

	onCleanup(() => snapshots.flush());

	const paintFromCache = async (did: string): Promise<void> => {
		if (!cacheEnabled()) return;
		const cached = await readThreads(ns(), did);
		if (!cached || cached.threads.length === 0) return;
		if (communityDid() !== did || hydrated()) return;
		apply(cached.threads);
	};

	const load = async (did: string, signal: AbortSignal): Promise<void> => {
		setLoading(true);
		const collected: Array<ThreadView> = [];
		let cursor: string | undefined;

		for (let page = 0; page < MAX_PAGES; page++) {
			const res = await client().call(
				colibri.thread.listThreads.main,
				{ params: { community: did, limit: PAGE_LIMIT, cursor } },
				{ signal },
			);
			if (signal.aborted) return;
			if (!res.ok) {
				setError(res.error);
				setLoading(false);
				return;
			}
			collected.push(...res.data.threads);
			cursor = res.data.cursor;
			if (!cursor || res.data.threads.length === 0) break;
		}

		setError(undefined);
		apply(collected);
		setHydrated(true);
		setLoading(false);
	};

	createEffect(
		on(communityDid, (did) => {
			setHydrated(false);
			if (did) void paintFromCache(did);
		}),
	);

	createEffect(() => {
		const did = communityDid();
		const list = threads();
		if (!did || !hydrated() || !cacheEnabled()) return;
		snapshots.schedule({ did, list });
	});

	createEffect(
		on([communityDid, reloads], ([did]) => {
			if (!did) return;
			const controller = new AbortController();
			onCleanup(() => controller.abort());
			void load(did, controller.signal).catch((err: unknown) => {
				if (controller.signal.aborted) return;
				log.error("could not list threads", { code: classifyThrown(err).code });
				setLoading(false);
			});
		}),
	);

	createEffect(() => {
		const cleanup = socket.onEvent((event) => {
			if (!frameIs(event, "threadEvent")) return;
			if (event.community !== communityDid()) return;

			if (event.event === "delete") {
				const space = event.space;
				if (!space) return;
				forgetThreadParent(space);
				setThreads((current) => removeThread(current, space));
				return;
			}

			if (event.event === "activity") {
				const space = event.space;
				const at = event.lastActivityAt;
				if (!space || !at) return;
				const fresh = event.thread;
				if (space !== openThreadSpace()) locallyRead.delete(space);
				setThreads((current) => {
					const touched = touchThread(current, space, at, {
						markUnread: space !== openThreadSpace(),
					});
					if (!fresh || fresh.space !== space) return touched;
					const held = touched.find((thread) => thread.space === space);
					if (!held) return upsertThread(touched, fresh);
					return upsertThread(touched, {
						...fresh,
						viewer: {
							...fresh.viewer,
							hasUnread: held.viewer.hasUnread,
							unreadMentions: held.viewer.unreadMentions,
						},
					});
				});
				return;
			}

			const thread = event.thread;
			if (!thread) return;
			rememberThreadParent(thread.space, thread.channel);
			setThreads((current) => upsertThread(current, settle(thread)));
		});
		onCleanup(cleanup);
	});

	const bySpace = (space: string): ThreadView | undefined =>
		threads().find((thread) => thread.space === space);

	const inChannel = (channel: string): Array<ThreadView> =>
		threadsInChannel(threads(), channel);

	const anchoredAt = (
		channel: string,
		author: string,
		rkey: string,
	): ThreadView | undefined =>
		threadAnchoredAt(threads(), channel, author, rkey);

	const adopt = (thread: ThreadView): ThreadView => {
		rememberThreadParent(thread.space, thread.channel);
		const next = settle(thread);
		setThreads((current) => upsertThread(current, next));
		return next;
	};

	const fetchThread = async (
		space: string,
	): Promise<ThreadView | undefined> => {
		const res = await client().call(colibri.thread.getThread.main, {
			params: { thread: space },
		});
		if (!res.ok) {
			log.warn("could not load thread", { code: res.error.code });
			return undefined;
		}
		return adopt(res.data.thread);
	};

	const createThread = async (
		input: CreateThreadInput,
	): Promise<ThreadView | undefined> => {
		const res = await client().call(colibri.thread.create.main, {
			body: {
				community: communityDid(),
				channel: input.channel,
				name: input.name,
				...(input.anchor ? { anchor: input.anchor } : {}),
				...(input.visibleToRoles?.length
					? { visibleToRoles: input.visibleToRoles }
					: {}),
				...(input.visibleToMembers?.length
					? { visibleToMembers: input.visibleToMembers }
					: {}),
			},
		});
		if (!res.ok) {
			showError(res.error, { report: false });
			return undefined;
		}
		return adopt(res.data.thread);
	};

	const updated = (res: XrpcResult<{ thread: ThreadView }>): boolean => {
		if (!res.ok) return fail(res);
		adopt(res.data.thread);
		return true;
	};

	const renameThread = async (space: string, name: string): Promise<boolean> =>
		updated(
			await client().call(colibri.thread.update.main, {
				body: { thread: space, name },
			}),
		);

	const setVisibility = async (
		space: string,
		visibility: {
			visibleToRoles: Array<string>;
			visibleToMembers: Array<string>;
		},
	): Promise<boolean> =>
		updated(
			await client().call(colibri.thread.update.main, {
				body: {
					thread: space,
					visibleToRoles: visibility.visibleToRoles,
					visibleToMembers: visibility.visibleToMembers,
				},
			}),
		);

	const repointThread = async (
		space: string,
		channel: string,
		anchor?: SpaceRecordRef,
	): Promise<boolean> =>
		updated(
			await client().call(colibri.thread.repoint.main, {
				body: anchor
					? { thread: space, channel, anchor }
					: { thread: space, channel },
			}),
		);

	const deleteThread = async (space: string): Promise<boolean> => {
		const res = await client().call(colibri.thread.delete.main, {
			body: { thread: space },
		});
		if (!res.ok) return fail(res);
		forgetThreadParent(space);
		setThreads((current) => removeThread(current, space));
		return true;
	};

	const patchViewer = (space: string, following: boolean) => {
		setThreads((current) =>
			current.map((thread) =>
				thread.space === space
					? { ...thread, viewer: { ...thread.viewer, following } }
					: thread,
			),
		);
	};

	const followThread = async (space: string): Promise<void> => {
		patchViewer(space, true);
		try {
			await enqueueSpaceCreate(
				space,
				user.did,
				COLLECTIONS.threadFollow,
				{ createdAt: asDatetime(new Date().toISOString()) },
				{ rkey: SELF, label: "Failed to follow thread." },
			);
		} catch {
			patchViewer(space, false);
		}
	};

	createEffect(() => {
		const cleanup = onOutboxSent(({ collection, space }) => {
			if (collection !== COLLECTIONS.message || !space) return;
			const thread = threads().find((entry) => entry.space === space);
			if (!thread || thread.viewer.following) return;
			void followThread(space);
		});
		onCleanup(cleanup);
	});

	createEffect(() => {
		const cleanup = socket.onEvent((event) => {
			if (!frameIs(event, "notificationEvent")) return;
			const kind = event.notification.kind;
			if (kind !== "mention" && kind !== "reply") return;
			const thread = threads().find(
				(entry) => entry.space === event.notification.channel,
			);
			if (!thread || thread.viewer.following) return;
			void followThread(thread.space);
		});
		onCleanup(cleanup);
	});

	const unfollowThread = async (space: string): Promise<void> => {
		patchViewer(space, false);
		try {
			await enqueueSpaceDelete(
				space,
				user.did,
				COLLECTIONS.threadFollow,
				SELF,
				{
					label: "Failed to leave thread.",
				},
			);
		} catch {
			patchViewer(space, true);
		}
	};

	const moveMessages = async (input: {
		source: string;
		destination: string;
		subjects: ReadonlyArray<MoveSubject>;
	}): Promise<boolean> => {
		const res = await client().call(colibri.thread.moveMessages.main, {
			body: {
				source: asSpaceRef(input.source),
				destination: asSpaceRef(input.destination),
				subjects: input.subjects.map((subject) => ({
					did: subject.author,
					rkey: subject.rkey,
				})),
			},
		});
		if (!res.ok) return fail(res);
		return true;
	};

	const openThread = (space: string | undefined) => {
		setOpenThreadSpace(space);
		if (space === undefined) return;
		setOpenedAt((current) => ({ ...current, [space]: Date.now() }));
	};

	const markRead = (space: string) => {
		locallyRead.add(space);
		setThreads((current) => markThreadRead(current, space));
	};

	const value: ThreadsContextValue = {
		draft,
		openDraft: setDraft,
		closeDraft: () => setDraft(undefined),
		threads,
		loading,
		error,
		bySpace,
		inChannel,
		anchoredAt,
		openThreadSpace,
		setOpenThreadSpace: openThread,
		openedAt,
		refresh: () => setReloads((n) => n + 1),
		fetchThread,
		createThread,
		renameThread,
		setVisibility,
		repointThread,
		deleteThread,
		followThread,
		unfollowThread,
		moveMessages,
		markRead,
	};

	return (
		<ThreadsContext.Provider value={value}>
			{props.children}
		</ThreadsContext.Provider>
	);
};

export const useThreads = (): ThreadsContextValue => {
	const ctx = useContext(ThreadsContext);
	if (!ctx) throw new Error("Unable to get threads context.");
	return ctx;
};
