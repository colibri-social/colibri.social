import {
	type ColibriError,
	classifyThrown,
	createLogger,
	createLru,
	isThreadSpace,
	MEMORY_WINDOW_COUNT,
	nextTid,
	refreshMessageWindow,
} from "@colibri-social/lib";
import {
	type Accessor,
	batch,
	createContext,
	createEffect,
	createMemo,
	createRoot,
	createSignal,
	getOwner,
	on,
	onCleanup,
	runWithOwner,
	untrack,
	useContext,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { createAccessStore } from "./access-store";
import { mentionedDids } from "./adapters/facets";
import { normalizeChannelLayout, sameChannel } from "./channel-layout";
import {
	type ChannelSummary,
	newerSummary,
	summarizeMessage,
	summarizePending,
} from "./channel-summary";
import { DEVICE_KEYS, deviceString } from "./device-prefs";
import { createEmojiStore } from "./emoji-store";
import { channelSlug, isVoiceChannel, skeyOf, spaceKey } from "./ids";
import { createJumpRequests } from "./jump";
import { createLegacyCommunities } from "./legacy-communities";
import { createLiveTails, reactIn, TAIL_PER_CHANNEL } from "./live-tail";
import { keepUnchanged } from "./merge";
import type { MessageCache } from "./message-cache";
import { isPingNotification } from "./notification-alerts";
import {
	createNotificationStore,
	createSpaceNotificationPrefs,
} from "./notifications";
import { createOutbox } from "./outbox/outbox";
import { withQueuedWrites } from "./outbox/overlay";
import type { OutboxEvent, OutboxOp, OutboxQueue } from "./outbox/types";
import { readStored, writeStored } from "./persist";
import { orderCommunities } from "./preferences/order";
import type { MuteSubject } from "./preferences/types";
import { createRecordStore } from "./record-store";
import { type CatchUpTask, createCatchUpQueue } from "./resume";
import {
	countChange,
	createRoleActions,
	type RoleActions,
	stripRole,
	upsertRole,
	viewerFrom,
	withoutRole,
} from "./role-store";
import {
	type CommunityImageKind,
	type CreateChannelInput,
	type DataSource,
	type ForwardInput,
	type LiveEvent,
	MESSAGE_COLLECTION,
	type ProfileTheme,
	type Simulation,
	type StatusInput,
	type ThreadAnchor,
	type UpdateChannelInput,
	type UpdateCommunityInput,
} from "./source";
import type { SpaceCache, SpaceSnapshot } from "./space-cache";
import { createSpaceDirectory } from "./space-directory";
import type {
	AttachmentView,
	CategoryPermissions,
	CategoryView,
	ChannelView,
	CommunityView,
	Did,
	Facet,
	MemberView,
	MessageView,
	Presence,
	ProfileView,
	ReactionEmojiRef,
	RoleView,
	SpaceRef,
	ThreadView,
	VoiceState,
} from "./types";
import { appVisible } from "./visibility";
import { connectVoice } from "./voice";

const PAGE_SIZE = 60;
const STALE_OPEN_MS = 15_000;
const CATCH_UP_PAGES = 4;
const CATCH_UP_SPACING_MS = 1_000;
const TYPING_MS = 6000;
const INVALIDATION_DELAY_MS = 50;

type Invalidation = { layout: boolean; roles: boolean; community: boolean };

const sameRoleSet = (
	left: readonly string[] | undefined,
	right: readonly string[] | undefined,
) => {
	const before = new Set(left ?? []);
	const after = new Set(right ?? []);
	return (
		before.size === after.size && [...before].every((rkey) => after.has(rkey))
	);
};

const log = createLogger("store");

export type ProfileDraft = {
	displayName: string;
	description: string;
	pronouns?: string;
	avatar?: File | null;
	banner?: File | null;
	syncBluesky: boolean;
	theme?: ProfileTheme;
	preferredBadge?: string | null;
};

export type ProfileSaveProgress = { avatar?: number; banner?: number };

export type Load<T> = {
	value: Accessor<T | undefined>;
	loading: Accessor<boolean>;
	error: Accessor<ColibriError | undefined>;
	retry: () => Promise<void> | void;
};

type MutableLoad<T> = Load<T> & {
	update: (change: (current: T) => T) => void;
	refresh: () => Promise<void>;
	peek?: () => T | undefined;
};

export type UnreadState = { hasUnread: boolean; mentions: number };

export type RememberedThread = {
	chat: string;
	channel: string;
	thread: string;
	channelType?: string;
	presentation?: "full";
};

export type PendingMessage = {
	nonce: string;
	rkey: string;
	channel: SpaceRef;
	text: string;
	facets?: Facet[];
	parent?: string;
	attachments?: AttachmentView[];
	uploads?: PendingUpload[];
	suppressedEmbeds?: string[];
	createdAt: string;
	state: "pending" | "failed";
};

export type PendingUpload = {
	id: string;
	file: File;
	previewSrc?: string;
	spoiler?: boolean;
	alt?: string;
	progress: number;
	attachment?: AttachmentView;
	failed?: boolean;
};

export type SpaceData = {
	community: CommunityView;
	categories: Load<CategoryView[]>;
	channels: Load<ChannelView[]>;
	roles: Load<RoleView[]>;
	members: Load<MemberView[]>;
	memberByDid: (did: Did) => MemberView | undefined;
	roleByKey: (rkey: string) => RoleView | undefined;
	setMemberRoles: (did: Did, roles: string[]) => Promise<void>;
	kick: (did: Did) => Promise<void>;
	ban: (did: Did) => Promise<void>;
	channelBySlug: (slug: string) => ChannelView | undefined;
	unread: (slug: string) => UnreadState;
	totals: Accessor<UnreadState>;
} & RoleActions;

export type ChannelData = {
	channel: SpaceRef;
	messages: Accessor<readonly MessageView[]>;
	pending: Accessor<readonly PendingMessage[]>;
	ready: Accessor<boolean>;
	confirmed: Accessor<boolean>;
	loadError: Accessor<ColibriError | undefined>;
	reload: () => Promise<void>;
	hasOlder: Accessor<boolean>;
	loadingOlder: Accessor<boolean>;
	loadOlder: () => void;
	hasNewer: Accessor<boolean>;
	loadingNewer: Accessor<boolean>;
	loadNewer: () => void;
	jumpToLatest: () => void;
	loadAround: (rkey: string) => Promise<boolean>;
	unreadAfter: Accessor<string | undefined>;
	enter: (fresh: boolean) => string | undefined;
	threads: Load<ThreadView[]>;
	typing: Accessor<readonly Did[]>;
	send: (input: {
		text: string;
		facets?: Facet[];
		parent?: string;
		attachments?: AttachmentView[];
		files?: {
			file: File;
			previewSrc?: string;
			spoiler?: boolean;
			alt?: string;
		}[];
		suppressedEmbeds?: string[];
	}) => Promise<void>;
	retry: (nonce: string) => Promise<void>;
	discard: (nonce: string) => void;
	edit: (rkey: string, text: string, facets?: Facet[]) => Promise<void>;
	remove: (rkey: string) => Promise<void>;
	react: (
		rkey: string,
		emoji: string,
		add: boolean,
		customEmoji?: ReactionEmojiRef,
	) => Promise<void>;
	setHidden: (rkey: string, hidden: boolean) => Promise<void>;
	setSuppressedEmbeds: (
		rkey: string,
		uris: string[],
		as: "author" | "moderator",
	) => Promise<void>;
	markRead: () => void;
	clearUnreadMarker: () => void;
	createThread: (input: CreateThreadDraft) => Promise<ThreadView>;
	detach: (rkeys: readonly string[]) => MessageView[];
	attach: (messages: readonly MessageView[]) => void;
};

export type CreateThreadDraft = {
	name: string;
	anchor?: ThreadAnchor;
};

type FeedGap = {
	after: string;
	latest: readonly MessageView[];
	cursor?: string;
};

const byRkey = (left: MessageView, right: MessageView) =>
	left.rkey < right.rkey ? -1 : left.rkey > right.rkey ? 1 : 0;

const oldestRkey = (items: readonly MessageView[]) =>
	items.reduce<string | undefined>(
		(min, message) => (!min || message.rkey < min ? message.rkey : min),
		undefined,
	);

const isBehind = (
	newest: string,
	page: { items: readonly MessageView[]; cursor?: string },
) => {
	const oldest = oldestRkey(page.items);
	return !!page.cursor && !!oldest && oldest > newest;
};

const insertSorted = (
	list: readonly MessageView[],
	incoming: readonly MessageView[],
): MessageView[] => {
	const next = list.slice();
	for (const message of [...incoming].sort((a, b) =>
		a.rkey < b.rkey ? -1 : 1,
	)) {
		const at = next.findIndex((entry) => entry.rkey > message.rkey);
		if (at < 0) next.push(message);
		else next.splice(at, 0, message);
	}
	return next;
};

const createLoad = <T>(
	fetch: () => Promise<T>,
	method: string,
	seed?: T,
): MutableLoad<T> => {
	const [value, setValue] = createSignal<T | undefined>(seed);
	const [loading, setLoading] = createSignal(seed === undefined);
	const [error, setError] = createSignal<ColibriError>();
	let attempt = 0;
	let running: Promise<void> | undefined;
	const run = (quiet = false): Promise<void> => {
		const current = ++attempt;
		if (!quiet)
			batch(() => {
				setLoading(true);
				setError(undefined);
			});
		let request: Promise<T>;
		try {
			request = fetch();
		} catch (thrown) {
			request = Promise.reject(thrown);
		}
		const settled = request.then(
			(result) => {
				if (current !== attempt) return;
				batch(() => {
					setValue((previous) =>
						quiet && previous !== undefined
							? keepUnchanged(previous, result)
							: result,
					);
					setLoading(false);
				});
			},
			(thrown: unknown) => {
				if (current !== attempt) return;
				const failure = classifyThrown(thrown, { method });
				log.warn("load failed", { method, code: failure.code });
				if (quiet && untrack(value) !== undefined) return;
				batch(() => {
					setError(failure);
					setLoading(false);
				});
			},
		);
		running = settled;
		return settled;
	};
	void run(seed !== undefined);
	const update = (change: (current: T) => T) =>
		setValue((current) => (current === undefined ? current : change(current)));
	const retry = (): Promise<void> =>
		untrack(loading) ? (running ?? Promise.resolve()) : run();
	const refresh = () =>
		untrack(value) === undefined || untrack(loading)
			? Promise.resolve()
			: run(true);
	return { value, loading, error, retry, update, refresh };
};

const createLazyLoad = <T>(
	fetch: () => Promise<T>,
	method: string,
	seed?: T,
): MutableLoad<T> => {
	let inner: MutableLoad<T> | undefined;
	const [started, setStarted] = createSignal(false);
	const ensure = () => {
		if (!inner) {
			inner = createRoot(() => createLoad(fetch, method, seed));
			setStarted(true);
		}
		return inner;
	};
	return {
		value: () => ensure().value(),
		loading: () => ensure().loading(),
		error: () => ensure().error(),
		retry: () => ensure().retry() ?? Promise.resolve(),
		update: (change) => inner?.update(change),
		refresh: () => inner?.refresh() ?? Promise.resolve(),
		peek: () => (started() ? inner?.value() : undefined),
	};
};

type ChannelWatcher = {
	watchChannel: (channel: SpaceRef) => () => void;
	viewChannel: (channel?: SpaceRef) => void;
};

const watchesChannels = (
	source: DataSource,
): source is DataSource & ChannelWatcher =>
	typeof (source as Partial<ChannelWatcher>).watchChannel === "function" &&
	typeof (source as Partial<ChannelWatcher>).viewChannel === "function";

export type DataStoreOptions = {
	cache?: MessageCache;
	spaces?: SpaceCache;
	outbox?: { queue?: OutboxQueue; held?: () => boolean };
	live?: { epoch: Accessor<number | undefined> };
	now?: () => number;
};

type ReadState = { cursor?: string; hasUnread: boolean };

export type WriteFailure = {
	kind: "edit" | "delete" | "react";
	code: string;
};

const OUTBOX_NONCE = "outbox:";
const outboxNonce = (seq: number) => `${OUTBOX_NONCE}${seq}`;
const outboxSeq = (nonce: string) =>
	nonce.startsWith(OUTBOX_NONCE)
		? Number(nonce.slice(OUTBOX_NONCE.length))
		: undefined;

const channelOfOp = (op: OutboxOp): SpaceRef | undefined => {
	if (op.t === "forward") return op.to;
	if (op.t === "deleteThread") return undefined;
	return op.channel;
};

const seededUnread = (snapshot: SpaceSnapshot | undefined) => {
	const seeded: Record<string, Record<string, UnreadState>> = {};
	for (const [community, entry] of Object.entries(snapshot?.spaces ?? {}))
		if (entry.unread) seeded[community] = { ...entry.unread };
	return seeded;
};

export const createDataStore = (
	source: DataSource,
	options: DataStoreOptions = {},
) =>
	createRoot((dispose) => {
		const owner = getOwner();
		const spaceCache = options.spaces;
		const snapshot = spaceCache?.snapshot();
		const persist = (track: () => void) => {
			if (!spaceCache) return;
			runWithOwner(owner, () => createEffect(track));
		};
		const [viewer, setViewer] = createStore<ProfileView>(source.viewer());
		const memberLoads = new Map<Did, MutableLoad<MemberView[]>>();
		const roleLoads = new Map<Did, MutableLoad<RoleView[]>>();
		const [simulation, setSimulationSignal] = createSignal(source.simulation());
		const loadedCommunities = createLoad(
			() => source.listCommunities(),
			"community.list",
			snapshot?.communities,
		);
		const orderedCommunities = createMemo(() =>
			orderCommunities(
				loadedCommunities.value(),
				source.preferences.communityOrder(),
			),
		);
		const communities: MutableLoad<CommunityView[]> = {
			...loadedCommunities,
			value: orderedCommunities,
		};
		persist(() => {
			const list = communities.value();
			if (list) spaceCache?.offerCommunities(list);
		});
		persist(() => {
			const profile: Record<string, unknown> = {};
			for (const key of Object.keys(viewer)) {
				if (key !== "presence") profile[key] = viewer[key as keyof ProfileView];
			}
			if (viewer.did) spaceCache?.offerViewer(profile as ProfileView);
		});
		const spaces = new Map<Did, SpaceData>();
		let resumes = 0;
		const currentEpoch = () => {
			const live = untrack(() => options.live?.epoch());
			return live === undefined ? undefined : `${live}:${resumes}`;
		};
		const summaryAnchors = new Map<SpaceRef, { rkey: string; epoch: string }>();
		const tails = createLiveTails({
			onEvict: (ref) => summaryAnchors.delete(ref),
		});
		const readStates = new Map<string, ReadState>();
		const cachedReads = new Map<string, ReadState>();
		const readKey = (community: string, slug: string) => `${community} ${slug}`;
		const summaries = createRecordStore<ChannelSummary>();
		const lastMessages = summaries.state;
		const putSummary = (summary: ChannelSummary) => {
			if (newerSummary(lastMessages[summary.channel], summary)) {
				summaries.put(summary.channel, summary);
			}
		};
		const anchorSummary = (summary: ChannelSummary, epoch?: string) => {
			const ref = summary.channel;
			if (epoch === undefined || isThreadSpace(ref) || tails.has(ref)) return;
			if (untrack(() => channels.get(ref)?.ready())) return;
			summaryAnchors.set(ref, { rkey: summary.rkey, epoch });
		};
		const loadSummaries = (community: Did, only?: SpaceRef): Promise<void> => {
			const epoch = currentEpoch();
			return source.listChannelSummaries(community).then(
				(list) => {
					const seen = new Set<string>();
					for (const summary of list) {
						seen.add(summary.channel);
						if (only && summary.channel !== only) continue;
						anchorSummary(summary, epoch);
						if (only) summaries.put(summary.channel, summary);
						else putSummary(summary);
					}
					if (only && !seen.has(only)) summaries.remove(only);
				},
				(thrown: unknown) =>
					log.warn("channel summaries failed", {
						code: classifyThrown(thrown, { method: "channel.listSummaries" })
							.code,
					}),
			);
		};
		const syncViewer = (community: Did, viewerRoles?: readonly string[]) => {
			const list = roleLoads.get(community)?.value();
			if (!list) return;
			communities.update((views) =>
				views.map((view) =>
					view.did === community ? viewerFrom(view, list, viewerRoles) : view,
				),
			);
		};
		const viewerRolesIn = (community: Did) =>
			untrack(() => communities.value())?.find((view) => view.did === community)
				?.viewer.roles;
		const refetchCommunity = (community: Did) =>
			source.getCommunity(community).then(
				(view) =>
					communities.update((list) =>
						list.map((entry) => (entry.did === community ? view : entry)),
					),
				(thrown: unknown) =>
					log.warn("community refetch failed", {
						code: classifyThrown(thrown, { method: "community.get" }).code,
					}),
			);
		const invalidated = new Map<Did, Invalidation>();
		let invalidationTimer: ReturnType<typeof setTimeout> | undefined;
		const flushInvalidations = () => {
			invalidationTimer = undefined;
			const pending = [...invalidated];
			invalidated.clear();
			for (const [community, scope] of pending) {
				if (scope.community) void refetchCommunity(community);
				if (scope.roles) {
					void roleLoads
						.get(community)
						?.refresh()
						.then(() => syncViewer(community));
				}
				if (!scope.layout) continue;
				void categoryLoads.get(community)?.refresh();
				void channelLoads.get(community)?.refresh();
				if (!spaces.has(community)) continue;
				void loadSummaries(community);
				void loadUnread(community);
			}
		};
		const invalidate = (community: Did, scope: keyof Invalidation) => {
			const entry = invalidated.get(community) ?? {
				layout: false,
				roles: false,
				community: false,
			};
			entry[scope] = true;
			invalidated.set(community, entry);
			invalidationTimer ??= setTimeout(
				flushInvalidations,
				INVALIDATION_DELAY_MS,
			);
		};
		onCleanup(() => clearTimeout(invalidationTimer));
		source.subscribe((event) => {
			if (event.$type === "layoutInvalidatedEvent") {
				invalidate(event.community, "layout");
				return;
			}
			if (event.$type === "rolesInvalidatedEvent") {
				invalidate(event.community, "roles");
				return;
			}
			if (event.$type === "communityInvalidatedEvent") {
				invalidate(event.community, "community");
				return;
			}
			if (event.$type === "roleRemovedEvent") {
				const roles = roleLoads.get(event.community);
				if (!roles) return;
				roles.update((list) => withoutRole(list, event.rkey));
				memberLoads
					.get(event.community)
					?.update((list) => stripRole(list, event.rkey));
				syncViewer(event.community);
				return;
			}
			if (event.$type === "roleEvent") {
				const roles = roleLoads.get(event.community);
				if (!roles) return;
				if (event.event === "delete") {
					roles.update((list) => withoutRole(list, event.role.rkey));
					memberLoads
						.get(event.community)
						?.update((list) => stripRole(list, event.role.rkey));
				} else {
					roles.update((list) => upsertRole(list, event.role));
				}
				syncViewer(event.community);
				return;
			}
			if (event.$type === "memberRolesEvent") {
				memberLoads
					.get(event.community)
					?.update((list) =>
						list.map((member) =>
							member.actor.did === event.subject
								? { ...member, roles: event.roles }
								: member,
						),
					);
				if (event.subject === viewer.did) {
					const changed = !sameRoleSet(
						viewerRolesIn(event.community),
						event.roles,
					);
					syncViewer(event.community, event.roles);
					if (changed) invalidate(event.community, "layout");
				}
				return;
			}
			if (event.$type === "memberUpdateEvent") {
				const subject = event.member.actor.did;
				memberLoads
					.get(event.community)
					?.update((list) =>
						list.map((member) =>
							member.actor.did === subject ? event.member : member,
						),
					);
				if (subject === viewer.did) {
					const changed = !sameRoleSet(
						viewerRolesIn(event.community),
						event.member.roles,
					);
					syncViewer(event.community, event.member.roles);
					applyViewer(event.member.actor);
					if (changed) invalidate(event.community, "layout");
				}
			}
		});
		const channels = new Map<SpaceRef, ChannelData>();
		const feedControls = new Map<
			SpaceRef,
			{
				ensureOpen: () => void;
				refresh: () => Promise<void>;
				refreshIfStale: () => Promise<void>;
				catchUp: () => Promise<void>;
				evict: () => void;
			}
		>();
		const cache = options.cache;
		const recentFeeds = createLru<true>(MEMORY_WINDOW_COUNT);
		const presences = createRecordStore<Presence>(
			snapshot?.presence ? { ...snapshot.presence } : {},
		);
		const presence = presences.state;
		const seededPresence = new Set(Object.keys(snapshot?.presence ?? {}));
		persist(() => {
			const known: Record<string, Presence> = {};
			for (const did of Object.keys(presence)) {
				const entry = presence[did];
				if (entry) known[did] = entry;
			}
			spaceCache?.offerPresence(known);
		});
		const [speaking, setSpeaking] = createStore<Record<string, boolean>>({});
		const voiceRoster = createMemo(() => {
			const roster = new Map<string, Did[]>();
			for (const did of Object.keys(presence)) {
				const channel = presence[did]?.voice?.channel;
				if (!channel) continue;
				const entry = roster.get(channel);
				if (entry) entry.push(did as Did);
				else roster.set(channel, [did as Did]);
			}
			return roster;
		});
		const unreadStates = createRecordStore<Record<string, UnreadState>>(
			seededUnread(snapshot),
		);
		const unread = unreadStates.state;
		const setUnread = (community: Did, slug: string, state: UnreadState) =>
			unreadStates.update(community, (entries) => ({
				...entries,
				[slug]: state,
			}));
		const [viewing, setViewing] = createSignal<SpaceRef>();
		const clock = options.now ?? Date.now;
		const threadOpenedAt = createRecordStore<number>();
		const holds = new Map<SpaceRef, { count: number; release: () => void }>();
		const holdChannel = (ref: SpaceRef): (() => void) => {
			const held = holds.get(ref);
			if (held) held.count += 1;
			else {
				const watching = watchesChannels(source);
				holds.set(ref, {
					count: 1,
					release: watching ? source.watchChannel(ref) : () => {},
				});
				if (watching) void feedControls.get(ref)?.refreshIfStale();
			}
			let holding = true;
			return () => {
				if (!holding) return;
				holding = false;
				const entry = holds.get(ref);
				if (!entry) return;
				entry.count -= 1;
				if (entry.count > 0) return;
				holds.delete(ref);
				entry.release();
			};
		};
		if (watchesChannels(source)) {
			createEffect(
				on(viewing, (ref) => {
					if (!ref) return;
					onCleanup(holdChannel(ref));
				}),
			);
			createEffect(
				on(
					() => (appVisible() ? viewing() : undefined),
					(ref) => {
						if (!ref) return;
						source.viewChannel(ref);
						onCleanup(() => source.viewChannel(undefined));
					},
				),
			);
		}
		const lastChannels = createRecordStore<string>();
		const [lastSpace, setLastSpace] = deviceString(DEVICE_KEYS.lastSpace);
		const lastChannel = (space: string) =>
			lastChannels.state[space] ?? readStored(DEVICE_KEYS.lastChannel(space));
		const setLastChannel = (space: string, channel: string) => {
			lastChannels.put(space, channel);
			setLastSpace(space);
			writeStored(DEVICE_KEYS.lastChannel(space), channel);
		};
		const rememberedThreads = new Map<string, RememberedThread>();
		const rememberedThread = (space: string) => rememberedThreads.get(space);
		const rememberThread = (space: string, thread?: RememberedThread) => {
			if (thread) rememberedThreads.set(space, thread);
			else rememberedThreads.delete(space);
		};
		const typingListeners = new Map<SpaceRef, (did: Did) => void>();
		const typingStops = new Map<SpaceRef, (did: Did) => void>();
		const sentNonces = new Map<string, string>();
		const outbox = createOutbox({
			source,
			queue: options.outbox?.queue,
			held: options.outbox?.held,
		});
		const outboxListeners = new Map<SpaceRef, (event: OutboxEvent) => void>();
		outbox.subscribe((event) => {
			const ref = channelOfOp(event.entry.op);
			if (ref) outboxListeners.get(ref)?.(event);
		});
		const writeFailureListeners = new Set<(failure: WriteFailure) => void>();
		const reportWriteFailure = (
			kind: WriteFailure["kind"],
			thrown: unknown,
		) => {
			const code = classifyThrown(thrown, { method: `outbox.${kind}` }).code;
			for (const listener of [...writeFailureListeners])
				listener({ kind, code });
		};
		const reactionKeys = new Map<string, string>();
		const messageListeners = new Map<SpaceRef, (event: LiveEvent) => boolean>();
		const notifications = createNotificationStore(source, (views, seen) => {
			const counts = new Map<SpaceRef, number>();
			for (const view of views) {
				if (view.thread || !view.message || !isPingNotification(view)) continue;
				counts.set(view.channel, (counts.get(view.channel) ?? 0) + 1);
			}
			batch(() => {
				for (const [ref, count] of counts) {
					const community = communityOfRef(ref);
					const slug = skeyOf(ref);
					const current = unread[community]?.[slug];
					if (!current) continue;
					setUnread(community, slug, {
						...current,
						mentions: Math.max(0, current.mentions + (seen ? -count : count)),
					});
				}
			});
		});
		const jumps = createJumpRequests();
		const spaceNotifications = createSpaceNotificationPrefs(source.preferences);

		const communityOfRef = (ref: SpaceRef) =>
			ref.slice("at://".length, ref.indexOf("/space/")) as Did;

		const onScreen = (ref: SpaceRef) =>
			untrack(viewing) === ref && untrack(appVisible);
		const unreadLoads = new Map<Did, Promise<void>>();
		const loadUnread = (community: Did): Promise<void> => {
			const load = source.listUnreadStatus(community).then(
				(statuses) => {
					const entries: Record<string, UnreadState> = {};
					for (const status of statuses) {
						const slug = skeyOf(status.channel);
						readStates.set(readKey(community, slug), {
							...(status.cursor ? { cursor: status.cursor } : {}),
							hasUnread: status.hasUnread,
						});
						entries[slug] = onScreen(status.channel)
							? {
									hasUnread: false,
									mentions: unread[community]?.[slug]?.mentions ?? 0,
								}
							: {
									hasUnread: status.hasUnread,
									mentions: status.unreadMentions,
								};
					}
					unreadStates.put(community, entries);
				},
				(thrown: unknown) =>
					log.warn("unread status failed", {
						code: classifyThrown(thrown, { method: "unread.list" }).code,
					}),
			);
			unreadLoads.set(community, load);
			return load;
		};
		const knownReadState = (ref: SpaceRef) =>
			readStates.get(readKey(communityOfRef(ref), skeyOf(ref)));
		const readStateOf = (ref: SpaceRef): Promise<ReadState | undefined> => {
			const known = knownReadState(ref);
			if (known) return Promise.resolve(known);
			const community = communityOfRef(ref);
			return (unreadLoads.get(community) ?? loadUnread(community)).then(
				() =>
					knownReadState(ref) ??
					cachedReads.get(readKey(community, skeyOf(ref))),
			);
		};
		const noteRead = (ref: SpaceRef, cursor?: string) => {
			const key = readKey(communityOfRef(ref), skeyOf(ref));
			const current = readStates.get(key);
			const next =
				cursor && (!current?.cursor || cursor > current.cursor)
					? cursor
					: current?.cursor;
			readStates.set(key, {
				...(next ? { cursor: next } : {}),
				hasUnread: false,
			});
		};

		const readsOf = (community: Did) => {
			const prefix = `${community} `;
			const reads: Record<string, ReadState> = {};
			for (const known of [cachedReads, readStates])
				for (const [key, state] of known)
					if (key.startsWith(prefix)) reads[key.slice(prefix.length)] = state;
			return Object.keys(reads).length > 0 ? reads : undefined;
		};

		const space = (community: CommunityView): SpaceData => {
			const existing = spaces.get(community.did);
			if (existing) return existing;
			const cached = snapshot?.spaces[community.did];
			const categories = createLoad(
				() => source.listCategories(community.did),
				"category.list",
				cached?.categories,
			);
			const channelList = createLoad(
				() => source.listChannels(community.did),
				"channel.list",
				cached?.channels,
			);
			for (const summary of cached?.summaries ?? []) putSummary(summary);
			for (const [slug, read] of Object.entries(cached?.reads ?? {}))
				cachedReads.set(readKey(community.did, slug), read);
			void loadSummaries(community.did);
			categoryLoads.set(community.did, categories);
			channelLoads.set(community.did, channelList);
			const roles = createLoad(
				() => source.listRoles(community.did),
				"role.list",
				cached?.roles,
			);
			roleLoads.set(community.did, roles);
			const members = createLazyLoad(
				async () => {
					memberLoads.set(community.did, members);
					const all: MemberView[] = [];
					let cursor: string | undefined;
					do {
						const page = await source.listMembers(community.did, {
							limit: 100,
							cursor,
						});
						all.push(...page.items);
						cursor = page.cursor;
					} while (cursor);
					presences.putAll(
						all.flatMap((member) => {
							const did = member.actor.did;
							const current = member.actor.presence;
							const stale = seededPresence.delete(did);
							if (stale && !current) presences.remove(did);
							return current && (stale || !untrack(() => presence[did]))
								? [[did, current] as const]
								: [];
						}),
					);
					return all;
				},
				"member.list",
				cached?.members,
			);
			void loadUnread(community.did);

			let memberIndex: Map<string, MemberView> | undefined;
			let memberIndexSource: MemberView[] | undefined;
			const memberByDid = (did: Did) => {
				const list = members.value();
				if (!list) return undefined;
				if (memberIndexSource !== list) {
					memberIndex = new Map(
						list.map((member) => [member.actor.did, member]),
					);
					memberIndexSource = list;
				}
				return memberIndex?.get(did);
			};

			const replaceMembers = (change: (list: MemberView[]) => MemberView[]) =>
				members.update(change);
			const setMemberRoles = async (did: Did, next: string[]) => {
				const previous = memberByDid(did)?.roles ?? [];
				const apply = (roles: string[]) =>
					replaceMembers((list) =>
						list.map((member) =>
							member.actor.did === did ? { ...member, roles } : member,
						),
					);
				const recount = (from: string[], to: string[]) => {
					roles.update((list) => countChange(list, from, to));
					if (did === viewer.did) syncViewer(community.did, to);
				};
				apply(next);
				recount(previous, next);
				try {
					await source.setMemberRoles({
						community: community.did,
						subject: did,
						roles: next,
					});
				} catch (error) {
					apply(previous);
					recount(next, previous);
					throw error;
				}
			};
			const removeWith =
				(call: DataSource["kickMember"]) => async (did: Did) => {
					await call({ community: community.did, subject: did });
					replaceMembers((list) =>
						list.filter((member) => member.actor.did !== did),
					);
				};

			const roleActions = createRoleActions({
				source,
				community: community.did,
				roles,
				members,
				syncViewer: () => syncViewer(community.did),
			});

			let layoutInput:
				| [CategoryView[] | undefined, ChannelView[] | undefined]
				| undefined;
			let layoutOutput: ReturnType<typeof normalizeChannelLayout> | undefined;
			const layout = () => {
				const nextCategories = categories.value();
				const nextChannels = channelList.value();
				if (
					!layoutOutput ||
					layoutInput?.[0] !== nextCategories ||
					layoutInput?.[1] !== nextChannels
				) {
					layoutInput = [nextCategories, nextChannels];
					layoutOutput = normalizeChannelLayout(nextCategories, nextChannels);
				}
				return layoutOutput;
			};

			const data: SpaceData = {
				...roleActions,
				community,
				categories: { ...categories, value: () => layout().categories },
				channels: { ...channelList, value: () => layout().channels },
				roles,
				members,
				memberByDid,
				roleByKey: (rkey) => roles.value()?.find((role) => role.rkey === rkey),
				setMemberRoles,
				kick: removeWith(source.kickMember),
				ban: removeWith(source.banMember),
				channelBySlug: (slug) =>
					layout().channels?.find((channel) => channelSlug(channel) === slug),
				unread: (slug) =>
					unread[community.did]?.[slug] ?? { hasUnread: false, mentions: 0 },
				totals: () => {
					if (spaceNotifications.isMuted(community.did)) {
						return { hasUnread: false, mentions: 0 };
					}
					const entries = Object.values(unread[community.did] ?? {});
					return {
						hasUnread: entries.some((entry) => entry.hasUnread),
						mentions: entries.reduce((sum, entry) => sum + entry.mentions, 0),
					};
				},
			};
			spaces.set(community.did, data);
			persist(() => {
				const patch = {
					categories: categories.value(),
					channels: channelList.value(),
					roles: roles.value(),
					members: members.peek?.(),
					unread: Object.fromEntries(
						Object.entries(unread[community.did] ?? {}).map(([slug, state]) => [
							slug,
							{ hasUnread: state.hasUnread, mentions: state.mentions },
						]),
					),
					reads: readsOf(community.did),
				};
				spaceCache?.offerSpace(community.did, patch);
			});
			persist(() => {
				const summaries = (channelList.value() ?? []).flatMap((channel) => {
					const summary = lastMessages[channel.space];
					return summary ? [summary] : [];
				});
				if (summaries.length > 0)
					spaceCache?.offerSpace(community.did, { summaries });
			});
			return data;
		};

		const markUnread = (message: MessageView) => {
			const ref = message.channel;
			if (viewing() === ref) return;
			if (message.author.did === viewer.did) return;
			const community = communityOfRef(ref);
			const slug = skeyOf(ref);
			const current = unread[community]?.[slug] ?? {
				hasUnread: false,
				mentions: 0,
			};
			setUnread(community, slug, { ...current, hasUnread: true });
			const key = readKey(community, slug);
			const known = readStates.get(key);
			if (known) readStates.set(key, { ...known, hasUnread: true });
		};

		const countedNotifications = new Set<string>();
		source.subscribe((event) => {
			if (event.$type !== "notificationEvent") return;
			const view = event.notification;
			if (view.thread || view.seenAt || !isPingNotification(view)) return;
			if (countedNotifications.has(view.id)) return;
			countedNotifications.add(view.id);
			const community = communityOfRef(view.channel);
			const slug = skeyOf(view.channel);
			const current = unread[community]?.[slug];
			setUnread(community, slug, {
				hasUnread: viewing() !== view.channel || !!current?.hasUnread,
				mentions: (current?.mentions ?? 0) + 1,
			});
		});

		const threadLoads = new Map<SpaceRef, MutableLoad<ThreadView[]>>();
		const threadsOf = (ref: SpaceRef): Load<ThreadView[]> => {
			const existing = threadLoads.get(ref);
			if (existing) return existing;
			const community = communityOfRef(ref);
			const created = createLazyLoad(
				() =>
					source.listThreads(ref).then((list) =>
						list.map((entry) =>
							onScreen(entry.space) && entry.viewer.hasUnread
								? {
										...entry,
										viewer: {
											...entry.viewer,
											hasUnread: false,
											unreadMentions: 0,
										},
									}
								: entry,
						),
					),
				"thread.list",
				snapshot?.spaces[community]?.threads?.[ref],
			);
			threadLoads.set(ref, created);
			persist(() => {
				const list = created.peek?.();
				if (list) spaceCache?.offerThreads(community, ref, list);
			});
			return created;
		};
		const markThreadSeen = (space: SpaceRef) => {
			for (const load of threadLoads.values()) {
				load.update((list) =>
					list.some((entry) => entry.space === space && entry.viewer.hasUnread)
						? list.map((entry) =>
								entry.space === space
									? {
											...entry,
											viewer: {
												...entry.viewer,
												hasUnread: false,
												unreadMentions: 0,
											},
										}
									: entry,
							)
						: list,
				);
			}
		};
		const channelLoads = new Map<Did, MutableLoad<ChannelView[]>>();
		const categoryLoads = new Map<Did, MutableLoad<CategoryView[]>>();
		const upsertThread = (thread: ThreadView) => {
			for (const [parent, load] of threadLoads) {
				if (parent === thread.channel) continue;
				load.update((list) =>
					list.some((entry) => entry.space === thread.space)
						? list.filter((entry) => entry.space !== thread.space)
						: list,
				);
			}
			threadLoads.get(thread.channel)?.update((list) => {
				const index = list.findIndex((entry) => entry.space === thread.space);
				if (index < 0) return [...list, thread];
				const next = [...list];
				next[index] = thread;
				return next;
			});
		};
		const removeThread = (thread: ThreadView) =>
			threadLoads
				.get(thread.channel)
				?.update((list) =>
					list.filter((entry) => entry.space !== thread.space),
				);
		source.subscribe((event) => {
			if (event.$type !== "threadEvent") return;
			if (event.event === "delete") removeThread(event.thread);
			else upsertThread(event.thread);
		});

		const applyReadCursors = (
			community: Did,
			cursors: readonly { channel: string; cursor: string }[],
		) => {
			const refs = new Map<string, SpaceRef>();
			for (const channel of untrack(
				() => channelLoads.get(community)?.value() ?? [],
			)) {
				refs.set(channelSlug(channel), channel.space);
			}
			const staleThreads = new Set<MutableLoad<ThreadView[]>>();
			let staleChannels = false;
			batch(() => {
				for (const { channel: slug, cursor } of cursors) {
					const key = readKey(community, slug);
					const known = readStates.get(key);
					const latest = refs.get(slug);
					const newest = latest ? lastMessages[latest]?.rkey : undefined;
					if (known && (!known.cursor || cursor > known.cursor)) {
						readStates.set(key, {
							cursor,
							hasUnread: known.hasUnread && (!newest || newest > cursor),
						});
					}
					const state = unread[community]?.[slug];
					if (state?.hasUnread) {
						const ref = refs.get(slug);
						const last = ref ? lastMessages[ref]?.rkey : undefined;
						if (last === undefined) staleChannels = true;
						else if (cursor >= last) {
							setUnread(community, slug, { ...state, hasUnread: false });
						}
					}
					for (const load of threadLoads.values()) {
						const unreadThread = load
							.peek?.()
							?.some(
								(entry) =>
									entry.viewer.hasUnread &&
									communityOfRef(entry.space) === community &&
									skeyOf(entry.space) === slug,
							);
						if (unreadThread) staleThreads.add(load);
					}
				}
			});
			for (const load of staleThreads) void load.refresh();
			if (staleChannels) void loadUnread(community);
		};
		source.subscribe((event) => {
			if (event.$type === "readCursorEvent") {
				applyReadCursors(event.community, event.cursors);
			}
		});

		const findThread = (ref: SpaceRef) => {
			for (const load of threadLoads.values()) {
				const hit = load.value()?.find((entry) => entry.space === ref);
				if (hit) return hit;
			}
			return undefined;
		};

		const patchThread = async (
			thread: ThreadView,
			next: ThreadView,
			call: () => Promise<unknown>,
		) => {
			upsertThread(next);
			try {
				const result = await call();
				if (result && typeof result === "object" && "space" in result) {
					upsertThread(result as ThreadView);
				}
			} catch (error) {
				upsertThread(thread);
				throw error;
			}
		};

		const anchorLoads = new Map<
			SpaceRef,
			Promise<ThreadView["anchorMessage"]>
		>();
		const anchorMessageOf = (thread: ThreadView) => {
			if (thread.anchorMessage) return Promise.resolve(thread.anchorMessage);
			if (!thread.anchor) return Promise.resolve(undefined);
			const existing = anchorLoads.get(thread.space);
			if (existing) return existing;
			const load = source
				.getThread(thread.space)
				.then((full) => full.anchorMessage)
				.catch((error: unknown) => {
					anchorLoads.delete(thread.space);
					throw error;
				});
			anchorLoads.set(thread.space, load);
			return load;
		};

		const threadMemberLoads = new Map<SpaceRef, MutableLoad<Did[]>>();
		const threadMembersOf = (
			thread: SpaceRef,
		): Load<Did[]> & {
			refresh: () => Promise<void>;
		} => {
			let load = threadMemberLoads.get(thread);
			if (!load) {
				const community = communityOfRef(thread);
				const created = createLazyLoad(
					() => source.listThreadMembers(thread),
					"thread.listMembers",
					snapshot?.spaces[community]?.threadMembers?.[thread],
				);
				load = created;
				threadMemberLoads.set(thread, load);
				persist(() => {
					const roster = created.peek?.();
					if (roster) spaceCache?.offerThreadMembers(community, thread, roster);
				});
			}
			const fetched = load;
			return {
				value: () => {
					const roster = fetched.value();
					if (!roster) return undefined;
					const live = (channels.get(thread)?.messages() ?? []).flatMap(
						(message) => [message.author.did, ...mentionedDids(message.facets)],
					);
					const added = live.filter((did) => !roster.includes(did));
					return added.length ? [...roster, ...new Set(added)] : roster;
				},
				loading: fetched.loading,
				error: fetched.error,
				retry: fetched.retry,
				refresh: fetched.refresh,
			};
		};
		const addThreadMember = (thread: SpaceRef, did: Did) =>
			threadMemberLoads
				.get(thread)
				?.update((list) => (list.includes(did) ? list : [...list, did]));

		const threadActions = {
			find: findThread,
			openedAt: (ref: SpaceRef) => threadOpenedAt.get(ref),
			anchorMessage: anchorMessageOf,
			rename: (thread: ThreadView, name: string) =>
				patchThread(thread, { ...thread, name: name.trim() }, () =>
					source.updateThread({ thread: thread.space, name: name.trim() }),
				),
			setClosed: (thread: ThreadView, closed: boolean) =>
				patchThread(
					thread,
					{
						...thread,
						closedAt: closed
							? (new Date().toISOString() as ThreadView["closedAt"])
							: undefined,
					},
					() => source.updateThread({ thread: thread.space, closed }),
				),
			setLocked: (thread: ThreadView, locked: boolean) =>
				patchThread(thread, { ...thread, locked: locked || undefined }, () =>
					source.updateThread({ thread: thread.space, locked }),
				),
			follow: async (thread: ThreadView, follow: boolean) => {
				if (follow) addThreadMember(thread.space, viewer.did);
				await patchThread(
					thread,
					{ ...thread, viewer: { ...thread.viewer, following: follow } },
					() => source.followThread({ thread: thread.space, follow }),
				);
				void threadMemberLoads.get(thread.space)?.refresh();
			},
			markRead: (thread: ThreadView) => {
				const ids = notifications
					.items()
					.filter((entry) => entry.thread === thread.space && !entry.seenAt)
					.map((entry) => entry.id);
				if (ids.length) void notifications.markRead(ids).catch(() => {});
				channels.get(thread.space)?.clearUnreadMarker();
				return patchThread(
					thread,
					{
						...thread,
						viewer: { ...thread.viewer, hasUnread: false, unreadMentions: 0 },
					},
					() => source.markRead(thread.space),
				);
			},
			remove: async (thread: ThreadView) => {
				removeThread(thread);
				try {
					await outbox.enqueue({ t: "deleteThread", thread: thread.space })
						.settled;
				} catch (error) {
					upsertThread(thread);
					throw error;
				}
			},
			repoint: async (thread: ThreadView, target: SpaceRef) => {
				const moved = { ...thread, channel: target };
				removeThread(thread);
				upsertThread(moved);
				try {
					upsertThread(
						await source.repoint({ thread: thread.space, channel: target }),
					);
				} catch (error) {
					removeThread(moved);
					upsertThread(thread);
					throw error;
				}
			},
		};

		const autoFollowing = new Set<SpaceRef>();
		const autoFollow = (ref: SpaceRef, lookup: boolean) => {
			if (autoFollowing.has(ref)) return;
			const known = untrack(() => findThread(ref));
			if (known?.viewer.following) return;
			if (!known && !lookup) return;
			autoFollowing.add(ref);
			const resolved = known ? Promise.resolve(known) : source.getThread(ref);
			void resolved
				.then((thread) =>
					thread.viewer.following
						? undefined
						: threadActions.follow(thread, true),
				)
				.catch((thrown: unknown) => {
					const failure = classifyThrown(thrown, {
						method: "thread.autoFollow",
					});
					log.warn("thread auto-follow failed", { code: failure.code });
				})
				.finally(() => autoFollowing.delete(ref));
		};
		outbox.subscribe((event) => {
			if (event.type !== "sent" || event.entry.op.t !== "send") return;
			autoFollow(event.entry.op.channel, false);
		});
		source.subscribe((event) => {
			if (event.$type !== "notificationEvent") return;
			const view = event.notification;
			if (!view.thread || !isPingNotification(view)) return;
			if (view.author?.did === viewer.did) return;
			autoFollow(view.thread, true);
		});

		const forgetLive = (match: (ref: SpaceRef) => boolean) => {
			tails.dropWhere(match);
			for (const ref of [...summaryAnchors.keys()])
				if (match(ref)) summaryAnchors.delete(ref);
		};
		const dropChannel = (community: Did, space: SpaceRef) => {
			cache?.forget(space);
			forgetLive((ref) => sameChannel(ref, space));
			readStates.delete(readKey(community, skeyOf(space)));
			channelLoads
				.get(community)
				?.update((list) =>
					list.filter((entry) => !sameChannel(entry.space, space)),
				);
			categoryLoads.get(community)?.update((list) =>
				list.map((category) =>
					category.channels.some((entry) => sameChannel(entry.space, space))
						? {
								...category,
								channels: category.channels.filter(
									(entry) => !sameChannel(entry.space, space),
								),
							}
						: category,
				),
			);
		};
		const withChannel = (community: Did, view: ChannelView, add: boolean) => {
			channelLoads.get(community)?.update((list) => {
				const rest = list.filter(
					(entry) => !sameChannel(entry.space, view.space),
				);
				return add ? [...rest, view] : rest;
			});
			categoryLoads.get(community)?.update((list) =>
				list.map((category) => {
					const rest = category.channels.filter(
						(entry) => !sameChannel(entry.space, view.space),
					);
					const channels =
						add && view.category === category.rkey ? [...rest, view] : rest;
					return channels.length === category.channels.length &&
						channels.every((entry, index) => entry === category.channels[index])
						? category
						: { ...category, channels };
				}),
			);
		};
		const patchChannel = (community: Did, view: ChannelView) => {
			channelLoads
				.get(community)
				?.update((list) =>
					list.some((entry) => sameChannel(entry.space, view.space))
						? list.map((entry) =>
								sameChannel(entry.space, view.space) ? view : entry,
							)
						: [...list, view],
				);
			categoryLoads.get(community)?.update((list) =>
				list.map((category) => {
					const index = category.channels.findIndex((entry) =>
						sameChannel(entry.space, view.space),
					);
					const belongs = view.category === category.rkey;
					if (index === -1) {
						return belongs
							? { ...category, channels: [...category.channels, view] }
							: category;
					}
					const channels = belongs
						? category.channels.map((entry, at) =>
								at === index ? view : entry,
							)
						: category.channels.filter((_, at) => at !== index);
					return { ...category, channels };
				}),
			);
		};
		const withCategory = (
			community: Did,
			view: CategoryView,
			event: "create" | "update" | "delete",
		) =>
			categoryLoads.get(community)?.update((list) => {
				if (event === "delete") {
					return list.filter((entry) => entry.rkey !== view.rkey);
				}
				if (!list.some((entry) => entry.rkey === view.rkey)) {
					return [...list, { ...view, channels: [...view.channels] }];
				}
				return list.map((entry) =>
					entry.rkey === view.rkey
						? { ...entry, ...view, channels: [...view.channels] }
						: entry,
				);
			});
		source.subscribe((event) => {
			if (event.$type === "categoryRemovedEvent") {
				categoryLoads
					.get(event.community)
					?.update((list) => list.filter((entry) => entry.rkey !== event.rkey));
				return;
			}
			if (event.$type === "channelRemovedEvent") {
				dropChannel(event.community, event.channel);
				return;
			}
			if (event.$type === "categoryEvent") {
				withCategory(event.community, event.category, event.event);
				return;
			}
			if (event.$type !== "channelEvent") return;
			if (event.event === "update") {
				patchChannel(event.community, event.channel);
				return;
			}
			withChannel(event.community, event.channel, event.event === "create");
		});

		const channelActions = {
			duplicate: async (view: ChannelView) => {
				const community = communityOfRef(view.space);
				const base = view.name.slice(0, 27);
				return source.createChannel({
					community,
					type: view.type,
					name: `${base}-copy`,
					category: view.category,
					description: view.description,
					private: view.private,
				});
			},
			remove: async (view: ChannelView) => {
				const community = communityOfRef(view.space);
				withChannel(community, view, false);
				try {
					await source.deleteChannel({ channel: view.space });
				} catch (error) {
					withChannel(community, view, true);
					throw error;
				}
			},
			create: async (input: CreateChannelInput) => {
				const view = await source.createChannel(input);
				withChannel(input.community, view, true);
				return view;
			},
			update: async (input: UpdateChannelInput) => {
				const view = await source.updateChannel(input);
				patchChannel(communityOfRef(view.space), view);
				return view;
			},
		};

		const categoryActions = {
			create: async (
				community: Did,
				name: string,
				permissions: CategoryPermissions = {},
			) => {
				const view = await source.createCategory({
					community,
					name,
					...permissions,
				});
				withCategory(community, view, "create");
				return view;
			},
			update: async (
				community: Did,
				category: string,
				changes: { name?: string } & CategoryPermissions,
			) => {
				const view = await source.updateCategory({
					community,
					category,
					...changes,
				});
				withCategory(community, view, "update");
				return view;
			},
			rename: async (community: Did, category: string, name: string) => {
				const view = await source.updateCategory({ community, category, name });
				withCategory(community, view, "update");
				return view;
			},
			remove: async (community: Did, category: CategoryView) => {
				await source.deleteCategory({ community, category: category.rkey });
				withCategory(community, category, "delete");
			},
		};

		const unseenInCommunity = (community: Did) =>
			notifications
				.items()
				.filter(
					(entry) =>
						!entry.seenAt && communityOfRef(entry.channel) === community,
				)
				.map((entry) => entry.id);

		const dropCommunity = (community: Did) => {
			cache?.forgetCommunity(community);
			forgetLive((ref) => communityOfRef(ref) === community);
			for (const key of [...readStates.keys()])
				if (key.startsWith(`${community} `)) readStates.delete(key);
			unreadLoads.delete(community);
			spaceCache?.forgetCommunity(community);
			communities.update((list) =>
				list.filter((entry) => entry.did !== community),
			);
			const ids = unseenInCommunity(community);
			if (ids.length) void notifications.markRead(ids).catch(() => {});
		};

		source.subscribe((event) => {
			if (event.$type === "memberJoinEvent") {
				if (event.member.actor.did === viewer.did) {
					void communities.refresh();
					return;
				}
				memberLoads
					.get(event.community)
					?.update((list) =>
						list.some((entry) => entry.actor.did === event.member.actor.did)
							? list
							: [...list, event.member],
					);
				return;
			}
			if (event.$type === "memberLeaveEvent") {
				if (event.subject === viewer.did) {
					dropCommunity(event.community);
					return;
				}
				memberLoads
					.get(event.community)
					?.update((list) =>
						list.filter((entry) => entry.actor.did !== event.subject),
					);
				return;
			}
			if (event.$type === "communityRemovedEvent") {
				dropCommunity(event.community);
				return;
			}
			if (event.$type !== "communityEvent") return;
			const view = event.community;
			if (event.event === "delete") {
				dropCommunity(view.did);
				return;
			}
			communities.update((list) =>
				list.some((entry) => entry.did === view.did)
					? list.map((entry) => (entry.did === view.did ? view : entry))
					: event.event === "create"
						? [...list, view]
						: list,
			);
		});

		const communityActions = {
			update: (input: UpdateCommunityInput) => source.updateCommunity(input),
			setImage: (
				community: Did,
				kind: CommunityImageKind,
				file: File | null,
				onProgress?: (fraction: number) => void,
			) =>
				file
					? source.putCommunityImage({ community, kind, file, onProgress })
					: source.deleteCommunityImage({ community, kind }),
			remove: async (community: Did) => {
				await source.deleteCommunity({ community });
				dropCommunity(community);
			},
			leave: async (community: Did) => {
				await source.leaveCommunity({ community });
				dropCommunity(community);
			},
			transferOwnership: async (community: Did, subject: Did) => {
				const result = await source.transferOwnership({ community, subject });
				try {
					const view = await source.getCommunity(community);
					communities.update((list) =>
						list.map((entry) => (entry.did === community ? view : entry)),
					);
				} catch (error) {
					log.warn("community refresh after transfer failed", {
						code: classifyThrown(error).code,
					});
				}
				return result;
			},
			markRead: async (community: Did) => {
				const views =
					channelLoads.get(community)?.value() ??
					(await source.listChannels(community));
				for (const view of views) {
					if (isVoiceChannel(view)) continue;
					const feed = channels.get(view.space);
					feed?.markRead();
					feed?.clearUnreadMarker();
					const slug = skeyOf(view.space);
					noteRead(view.space);
					if (unread[community]?.[slug]?.hasUnread) {
						setUnread(community, slug, {
							...unread[community][slug],
							hasUnread: false,
						});
					}
					void source.markRead(view.space).catch(() => {});
				}
				const ids = unseenInCommunity(community);
				if (ids.length) await notifications.markRead(ids);
			},
		};

		const touchFeed = (ref: SpaceRef) => {
			for (const key of recentFeeds.remember(ref, true)) {
				const evicted = key as SpaceRef;
				if (holds.has(evicted) || viewing() === evicted) {
					recentFeeds.remember(evicted, true);
					continue;
				}
				feedControls.get(evicted)?.evict();
			}
		};

		const newestSince = async (ref: SpaceRef, newestKnown?: string) => {
			const items: MessageView[] = [];
			let next: string | undefined;
			let pages = 0;
			do {
				const page = await source.listMessages({
					channel: ref,
					limit: PAGE_SIZE,
					cursor: next,
				});
				items.push(...page.items);
				next = page.cursor;
				pages += 1;
				const oldest = oldestRkey(page.items);
				if (!newestKnown || !oldest || oldest <= newestKnown) break;
			} while (next && pages < CATCH_UP_PAGES);
			return next ? { items, cursor: next } : { items };
		};

		const channel = (ref: SpaceRef): ChannelData => {
			const existing = channels.get(ref);
			if (existing) {
				feedControls.get(ref)?.ensureOpen();
				return existing;
			}

			const [storedMessages, setMessageList] = createSignal<
				readonly MessageView[]
			>([]);
			const messages = withQueuedWrites(
				storedMessages,
				outbox.entries,
				ref,
				viewer.did,
			);
			const [pending, setPending] = createSignal<readonly PendingMessage[]>([]);
			const [ready, setReady] = createSignal(false);
			const [confirmed, setConfirmed] = createSignal(false);
			const [openError, setOpenError] = createSignal<ColibriError>();
			let opening = false;
			let attempt: { started: number; promise: Promise<void> } | undefined;
			const track = (
				run: (isCurrent: () => boolean) => Promise<void>,
			): Promise<void> => {
				const entry = {
					started: Date.now(),
					promise: Promise.resolve(),
				};
				const isCurrent = () => attempt === entry;
				attempt = entry;
				opening = true;
				entry.promise = run(isCurrent).finally(() => {
					if (!isCurrent()) return;
					attempt = undefined;
					opening = false;
				});
				return entry.promise;
			};
			const [cursor, setCursor] = createSignal<string>();
			const [loadingOlder, setLoadingOlder] = createSignal(false);
			const [unreadAfter, setUnreadAfter] = createSignal<string>();
			const [gap, setGap] = createSignal<FeedGap>();
			const [loadingNewer, setLoadingNewer] = createSignal(false);
			const [typingSet, setTypingSet] = createSignal<readonly Did[]>([]);
			const typingTimers = new Map<Did, ReturnType<typeof setTimeout>>();
			const community = communityOfRef(ref);
			let readThrough: string | undefined;
			let confirmedEpoch: string | undefined;
			let provisionalFrom: string | undefined;
			let predecessor: string | undefined;
			const threads = threadsOf(ref);

			const remember = () => {
				if (!cache || !ready()) return;
				const held = gap();
				const next = held ? held.cursor : cursor();
				cache.offer(ref, held ? held.latest : messages(), {
					cursor: next,
					hasMore: !!next,
					readCursor: readThrough,
				});
			};
			const editLatest = (
				change: (latest: readonly MessageView[]) => readonly MessageView[],
			) => {
				const held = untrack(gap);
				if (!held) return;
				setGap({ ...held, latest: change(held.latest) });
				remember();
			};
			const discardedSends = new Map<string, "waiting" | "retracting">();
			const withoutDiscarded = (list: readonly MessageView[]) =>
				discardedSends.size > 0 &&
				list.some((message) => discardedSends.has(message.rkey))
					? list.filter((message) => !discardedSends.has(message.rkey))
					: list;
			const setMessages = (
				next:
					| readonly MessageView[]
					| ((current: readonly MessageView[]) => readonly MessageView[]),
			) => {
				setMessageList((current) =>
					withoutDiscarded(typeof next === "function" ? next(current) : next),
				);
				remember();
			};

			const paint = (window: {
				messages: MessageView[];
				cursor?: string;
				readCursor?: string;
			}) =>
				batch(() => {
					predecessor = undefined;
					setMessageList(window.messages);
					setCursor(window.cursor);
					readThrough = window.readCursor ?? readThrough;
					setReady(true);
				});

			const covers = (list: readonly MessageView[], after?: string) => {
				const target = jumps.peek(ref);
				if (target && !list.some((message) => message.rkey === target))
					return false;
				if (!untrack(() => unread[community]?.[skeyOf(ref)]?.hasUnread))
					return true;
				const through = knownReadState(ref)?.cursor;
				const floor = after ?? list[0]?.rkey;
				return !!through && !!floor && through >= floor;
			};

			const paintFromTail = (window?: {
				messages: readonly MessageView[];
				cursor?: string;
				readCursor?: string;
			}): "continuous" | "provisional" | undefined => {
				const tail = tails.peek(ref);
				const latest = tail?.messages ?? [];
				const first = latest[0];
				if (!tail || !first) return undefined;
				const epoch = currentEpoch();
				const continuous =
					!isThreadSpace(ref) && epoch !== undefined && tail.epoch === epoch;
				const stored = window?.messages ?? [];
				const storedNewest = stored.at(-1)?.rkey;
				const overlaps = !!storedNewest && storedNewest >= first.rkey;
				const held: FeedGap | undefined =
					storedNewest && !overlaps && !continuous
						? { after: storedNewest, latest, cursor: tail.cursor }
						: undefined;
				const list = overlaps
					? [
							...new Map(
								[...stored, ...latest].map((message) => [
									message.rkey,
									message,
								]),
							).values(),
						].sort(byRkey)
					: held
						? stored.slice()
						: latest.slice();
				const after = overlaps || held ? undefined : tail.after;
				if (!covers(list, after)) return undefined;
				tails.take(ref);
				summaryAnchors.delete(ref);
				batch(() => {
					setGap(held);
					setMessageList(list);
					setCursor(overlaps || held ? window?.cursor : tail.cursor);
					setUnreadAfter(undefined);
					readThrough =
						knownReadState(ref)?.cursor ?? window?.readCursor ?? readThrough;
					setReady(true);
				});
				confirmedEpoch = continuous ? epoch : undefined;
				provisionalFrom = continuous ? undefined : first.rkey;
				predecessor = after;
				if (continuous) setConfirmed(true);
				remember();
				return continuous ? "continuous" : "provisional";
			};

			const paintFromMemory = () => {
				const remembered = cache?.recall(ref);
				const outcome = paintFromTail(remembered);
				if (!outcome && remembered) paint(remembered);
				return outcome;
			};
			const painted = paintFromMemory();

			const refreshFromNetwork = async (keepPlace = false) => {
				const held = untrack(gap);
				const patchy = provisionalFrom;
				const newestKnown = patchy
					? undefined
					: (held ? held.latest : untrack(messages)).at(-1)?.rkey;
				const fetched = await newestSince(ref, newestKnown);
				const page = {
					...fetched,
					items: withoutDiscarded(fetched.items) as MessageView[],
				};
				readThrough = knownReadState(ref)?.cursor ?? readThrough;
				provisionalFrom = undefined;
				const replaces =
					!!patchy && !!page.cursor && (oldestRkey(page.items) ?? "") > patchy;
				if (replaces) predecessor = undefined;
				const refreshed = (
					list: readonly MessageView[],
					cachedCursor: string | undefined,
				) =>
					replaces
						? { messages: [...page.items].sort(byRkey), cursor: page.cursor }
						: refreshMessageWindow(list, page, {
								pageSize: PAGE_SIZE,
								cachedCursor,
							});
				const current = untrack(gap);
				if (current) {
					const merged = refreshed(current.latest, current.cursor);
					setGap({
						after: current.after,
						latest: merged.messages,
						cursor: merged.cursor,
					});
					remember();
					return;
				}
				const newest = untrack(messages).at(-1)?.rkey;
				if (keepPlace && newest && isBehind(newest, page)) {
					setGap({
						after: newest,
						latest: [...page.items].sort(byRkey),
						cursor: page.cursor,
					});
					remember();
					return;
				}
				const merged = refreshed(untrack(messages), untrack(cursor));
				batch(() => {
					setCursor(merged.cursor);
					setMessages(merged.messages);
				});
			};

			const open = async (): Promise<boolean> => {
				if (!untrack(ready) && cache) {
					const stored = await cache.read(ref);
					if (stored && !untrack(ready)) {
						const outcome = paintFromTail(stored);
						if (outcome === "continuous") return true;
						if (!outcome) paint(stored);
					}
				}
				if (untrack(ready) && untrack(messages).length > 0) {
					await refreshFromNetwork();
					return false;
				}
				const target = jumps.peek(ref);
				const position = readStateOf(ref);
				const aroundPageOf = (rkey: string | undefined) =>
					rkey
						? source.listMessages({
								channel: ref,
								limit: PAGE_SIZE,
								around: rkey,
							})
						: undefined;
				const [latestPage, aroundPage, status] = await Promise.all([
					source.listMessages({ channel: ref, limit: PAGE_SIZE }),
					target
						? aroundPageOf(target)
						: position.then((state) =>
								aroundPageOf(state?.hasUnread ? state.cursor : undefined),
							),
					position,
				]);
				const readCursor = status?.hasUnread ? status.cursor : undefined;
				const latest = latestPage.items.slice().sort(byRkey);
				const around = aroundPage?.items.slice().sort(byRkey) ?? [];
				const aroundNewest = around.at(-1)?.rkey;
				const joinAt = latest[0]?.rkey;
				const detached =
					!!aroundPage?.forwardCursor &&
					!!aroundNewest &&
					!!joinAt &&
					aroundNewest < joinAt;
				const collected = detached
					? around
					: [
							...new Map(
								[...around, ...latest].map((message) => [
									message.rkey,
									message,
								]),
							).values(),
						].sort(byRkey);
				const oldest = collected[0]?.rkey;
				const next =
					aroundPage && (detached || (oldest && joinAt && oldest < joinAt))
						? aroundPage.cursor
						: latestPage.cursor;
				const firstUnread = readCursor
					? collected.find((message) => message.rkey > readCursor)
					: undefined;
				readThrough = status?.cursor ?? latest.at(-1)?.rkey;
				const late = tails.take(ref);
				summaryAnchors.delete(ref);
				predecessor = undefined;
				batch(() => {
					setGap(
						detached && aroundNewest
							? { after: aroundNewest, latest, cursor: latestPage.cursor }
							: undefined,
					);
					setMessages(collected);
					setCursor(next);
					setUnreadAfter(
						firstUnread
							? collected[collected.indexOf(firstUnread) - 1]?.rkey
							: undefined,
					);
					setReady(true);
					for (const message of late?.messages ?? []) upsert(message);
				});
				remember();
				return false;
			};

			const confirm = (epoch: string | undefined) => {
				confirmedEpoch = epoch;
				setConfirmed(true);
			};

			const openFeed = (keepError = false): Promise<void> => {
				if (attempt) return attempt.promise;
				if (!keepError) setOpenError(undefined);
				const epoch = currentEpoch();
				return track((isCurrent) =>
					open().then(
						(continuous) => {
							if (!isCurrent()) return;
							setOpenError(undefined);
							if (!continuous) confirm(epoch);
						},
						(thrown: unknown) => {
							const failure = classifyThrown(thrown, {
								method: "channel.listMessages",
							});
							log.warn("channel open failed", { code: failure.code });
							if (isCurrent()) setOpenError(failure);
						},
					),
				);
			};

			const reload = (): Promise<void> => {
				const running = attempt;
				if (running && Date.now() - running.started < STALE_OPEN_MS) {
					return running.promise;
				}
				if (running) {
					attempt = undefined;
					opening = false;
				}
				if (untrack(ready) && !untrack(openError)) return Promise.resolve();
				return openFeed(true);
			};

			const loadOlder = () => {
				const before = cursor();
				if (!before || loadingOlder()) return;
				setLoadingOlder(true);
				void source
					.listMessages({ channel: ref, limit: PAGE_SIZE, cursor: before })
					.then(
						(page) =>
							batch(() => {
								setMessages((list) => [
									...page.items.slice().reverse(),
									...list,
								]);
								setCursor(page.cursor);
								setLoadingOlder(false);
							}),
						(thrown: unknown) => {
							log.warn("older messages failed", {
								code: classifyThrown(thrown, {
									method: "channel.listMessages",
								}).code,
							});
							setLoadingOlder(false);
						},
					);
			};

			const loadNewer = () => {
				const held = gap();
				if (!held || loadingNewer()) return;
				setLoadingNewer(true);
				void source
					.listMessages({
						channel: ref,
						limit: PAGE_SIZE,
						cursor: held.after,
						reverse: true,
					})
					.then(
						(page) => {
							const current = untrack(gap);
							if (current?.after !== held.after) {
								setLoadingNewer(false);
								return;
							}
							const items = page.items
								.filter((message) => message.rkey > current.after)
								.sort(byRkey);
							const joinAt = current.latest[0]?.rkey;
							const newest = items.at(-1)?.rkey;
							const joined =
								!page.cursor || !newest || (!!joinAt && newest >= joinAt);
							batch(() => {
								if (joined) {
									const tail = [
										...new Map(
											[...items, ...current.latest].map((message) => [
												message.rkey,
												message,
											]),
										).values(),
									].sort(byRkey);
									setGap(undefined);
									setMessages((list) => [...list, ...tail]);
								} else {
									setGap({ ...current, after: newest });
									setMessages((list) => [...list, ...items]);
								}
								setLoadingNewer(false);
							});
						},
						(thrown: unknown) => {
							log.warn("loading newer messages failed", {
								code: classifyThrown(thrown, {
									method: "channel.listMessages",
								}).code,
							});
							setLoadingNewer(false);
						},
					);
			};

			const loadAround = async (rkey: string) => {
				if (untrack(storedMessages).some((message) => message.rkey === rkey))
					return true;
				const page = await source.listMessages({
					channel: ref,
					limit: PAGE_SIZE,
					around: rkey,
				});
				const items = page.items.slice().sort(byRkey);
				const oldest = items[0]?.rkey;
				const newest = items.at(-1)?.rkey;
				if (!oldest || !newest) return false;
				const held = untrack(gap);
				const latest = held ? held.latest : untrack(storedMessages);
				const latestCursor = held ? held.cursor : untrack(cursor);
				const joinAt = latest[0]?.rkey;
				const joined = !page.forwardCursor || (!!joinAt && newest >= joinAt);
				batch(() => {
					if (joined) {
						setGap(undefined);
						setMessages(
							[
								...new Map(
									[...items, ...latest].map((message) => [
										message.rkey,
										message,
									]),
								).values(),
							].sort(byRkey),
						);
						setCursor(!joinAt || oldest < joinAt ? page.cursor : latestCursor);
					} else {
						setGap({ after: newest, latest, cursor: latestCursor });
						setMessages(items);
						setCursor(page.cursor);
					}
				});
				return items.some((message) => message.rkey === rkey);
			};

			const jumpToLatest = () => {
				const held = untrack(gap);
				if (!held) return;
				batch(() => {
					setGap(undefined);
					setCursor(held.cursor);
					setMessages(held.latest);
				});
			};

			const retract = (rkey: string) => {
				if (discardedSends.get(rkey) !== "waiting") return;
				discardedSends.set(rkey, "retracting");
				void data.remove(rkey);
			};

			const upsert = (message: MessageView) => {
				if (discardedSends.has(message.rkey)) return;
				const place = (list: readonly MessageView[]) => {
					const index = list.findIndex((entry) => entry.rkey === message.rkey);
					if (index === -1) return insertSorted(list, [message]);
					const next = list.slice();
					next[index] = message;
					return next;
				};
				const after = untrack(gap)?.after;
				if (after && message.rkey > after) editLatest(place);
				else setMessages(place);
			};

			const beforeWindow = (message: MessageView) => {
				const list = untrack(messages);
				const oldest = list[0]?.rkey;
				return (
					!!untrack(cursor) &&
					!!oldest &&
					message.rkey < oldest &&
					!list.some((entry) => entry.rkey === message.rkey)
				);
			};

			const replaceSummary = (rkey: string, summary: ChannelSummary) => {
				if (lastMessages[ref]?.rkey === rkey) summaries.put(ref, summary);
			};

			const settlePending = (nonce: string, message: MessageView) => {
				const settled = pending().find((entry) => entry.nonce === nonce);
				batch(() => {
					if (settled) {
						setPending((list) => list.filter((entry) => entry.nonce !== nonce));
					}
					upsert(message);
					replaceSummary(message.rkey, summarizeMessage(message));
				});
				if (settled) revokePreviews(settled);
			};

			const settleEcho = (message: MessageView) => {
				if (discardedSends.has(message.rkey)) {
					retract(message.rkey);
					return true;
				}
				const nonce = sentNonces.get(message.rkey);
				if (!nonce) return false;
				settlePending(nonce, message);
				return true;
			};

			const patchPending = (
				nonce: string,
				change: (entry: PendingMessage) => PendingMessage,
			) =>
				setPending((list) =>
					list.map((item) => (item.nonce === nonce ? change(item) : item)),
				);

			const patchUpload = (
				nonce: string,
				id: string,
				change: Partial<PendingUpload>,
			) =>
				patchPending(nonce, (entry) => ({
					...entry,
					uploads: entry.uploads?.map((upload) =>
						upload.id === id ? { ...upload, ...change } : upload,
					),
				}));

			const revokePreviews = (entry: PendingMessage) => {
				for (const upload of entry.uploads ?? []) {
					if (upload.previewSrc?.startsWith("blob:")) {
						URL.revokeObjectURL(upload.previewSrc);
					}
				}
			};

			const dropPending = (nonce: string) => {
				const dropped = untrack(pending).find((entry) => entry.nonce === nonce);
				if (!dropped) return;
				setPending((list) => list.filter((entry) => entry.nonce !== nonce));
				revokePreviews(dropped);
			};

			const adoptQueued = () => {
				const known = new Set(untrack(pending).map((entry) => entry.rkey));
				const adopted: PendingMessage[] = [];
				for (const entry of untrack(outbox.entries)) {
					const op = entry.op;
					if (op.t !== "send" || op.channel !== ref || known.has(op.rkey))
						continue;
					const nonce = outboxNonce(entry.seq);
					sentNonces.set(op.rkey, nonce);
					adopted.push({
						nonce,
						rkey: op.rkey,
						channel: ref,
						text: op.text,
						facets: op.facets,
						parent: op.parent,
						attachments: op.attachments,
						...(op.suppressedEmbeds?.length
							? { suppressedEmbeds: op.suppressedEmbeds }
							: {}),
						uploads: op.files.length
							? op.files.map((file, index) => ({
									id: `${index}`,
									file: file.file,
									previewSrc: file.file.type.startsWith("image/")
										? URL.createObjectURL(file.file)
										: undefined,
									...(file.spoiler ? { spoiler: true } : {}),
									...(file.alt ? { alt: file.alt } : {}),
									progress: file.attachment ? 1 : 0,
									...(file.attachment ? { attachment: file.attachment } : {}),
								}))
							: undefined,
						createdAt: new Date(entry.createdAt).toISOString(),
						state: entry.failed ? "failed" : "pending",
					});
				}
				const newest = adopted.at(-1);
				if (newest) {
					setPending((list) => [...list, ...adopted]);
					putSummary(summarizePending(newest, viewer.did));
				}
			};

			const applyReaction = (
				rkey: string,
				emoji: string,
				actor: Did,
				add: boolean,
				customEmoji?: ReactionEmojiRef,
			) => {
				const react = (list: readonly MessageView[]) =>
					reactIn(list, {
						rkey,
						emoji,
						customEmoji,
						actor,
						add,
						viewer: viewer.did,
					});
				setMessages(react);
				editLatest(react);
			};

			outboxListeners.set(ref, (event) => {
				if (
					event.entry.op.t === "forward" &&
					event.type === "sent" &&
					event.message &&
					untrack(ready)
				) {
					upsert(event.message);
					return;
				}
				if (event.entry.op.t !== "send") return;
				const nonce = outboxNonce(event.entry.seq);
				if (event.type === "landedAfterDiscard") {
					retract(event.entry.op.rkey);
					return;
				}
				if (event.type === "progress") {
					patchUpload(
						nonce,
						`${event.file}`,
						event.failed
							? { failed: true }
							: { progress: event.fraction, failed: false },
					);
					return;
				}
				if (event.type === "sent") {
					if (event.message) {
						settlePending(nonce, event.message);
						return;
					}
					const drop = () => dropPending(nonce);
					const refreshing = feedControls.get(ref)?.refresh();
					if (refreshing) void refreshing.then(drop, drop);
					else drop();
					return;
				}
				if (event.type === "failed") {
					patchPending(nonce, (item) => ({ ...item, state: "failed" }));
					return;
				}
				dropPending(nonce);
			});
			void outbox.ready().then(adoptQueued);

			messageListeners.set(ref, (event) => {
				if (
					event.$type === "messageEvent" &&
					event.event !== "delete" &&
					event.message &&
					settleEcho(event.message)
				)
					return true;
				if (!untrack(ready)) return false;
				if (event.$type === "messageEvent") {
					if (event.event === "delete" && event.rkey) {
						const rkey = event.rkey;
						const drop = (list: readonly MessageView[]) =>
							list.filter((entry) => entry.rkey !== rkey);
						setMessages(drop);
						editLatest(drop);
						return true;
					}
					if (event.message && beforeWindow(event.message)) return true;
					if (event.message) upsert(event.message);
					return true;
				}
				if (event.$type === "reactionEvent") {
					applyReaction(
						event.target,
						event.emoji,
						event.actor,
						event.event === "create",
						event.customEmoji,
					);
				}
				return true;
			});

			typingListeners.set(ref, (did) => {
				if (did === viewer.did) return;
				const timer = typingTimers.get(did);
				if (timer) clearTimeout(timer);
				setTypingSet((list) => (list.includes(did) ? list : [...list, did]));
				typingTimers.set(
					did,
					setTimeout(() => {
						typingTimers.delete(did);
						setTypingSet((list) => list.filter((entry) => entry !== did));
					}, TYPING_MS),
				);
			});

			const stopTyping = (did: Did) => {
				const timer = typingTimers.get(did);
				if (timer) clearTimeout(timer);
				typingTimers.delete(did);
				setTypingSet((list) => list.filter((entry) => entry !== did));
			};

			const data: ChannelData = {
				channel: ref,
				messages,
				pending,
				ready,
				confirmed,
				loadError: openError,
				reload,
				hasOlder: () => !!cursor(),
				hasNewer: () => !!gap(),
				loadingNewer,
				loadNewer,
				jumpToLatest,
				loadAround,
				loadingOlder,
				loadOlder,
				unreadAfter,
				enter: (fresh) => {
					touchFeed(ref);
					if (!ready()) return undefined;
					const state = unread[community]?.[skeyOf(ref)];
					const through = readThrough;
					if (!state?.hasUnread || !through) {
						if (fresh) setUnreadAfter(undefined);
						return undefined;
					}
					const list = messages();
					const first = list.findIndex(
						(message) =>
							message.rkey > through && message.author.did !== viewer.did,
					);
					if (first < 0) {
						if (fresh) setUnreadAfter(undefined);
						return undefined;
					}
					const before =
						list[first - 1]?.rkey ??
						(predecessor && through >= predecessor && untrack(cursor)
							? through
							: undefined);
					setUnreadAfter(before);
					return list[first]?.rkey;
				},
				threads,
				detach: (rkeys) => {
					const keys = new Set(rkeys);
					const keep = (list: readonly MessageView[]) =>
						list.filter((entry) => !keys.has(entry.rkey));
					const removed = [
						...messages(),
						...(untrack(gap)?.latest ?? []),
					].filter((entry) => keys.has(entry.rkey));
					if (removed.length > 0) {
						setMessages(keep);
						editLatest(keep);
					}
					return removed;
				},
				attach: (incoming) => {
					if (!ready() || incoming.length === 0) return;
					const keys = new Set(incoming.map((entry) => entry.rkey));
					const after = untrack(gap)?.after;
					const newer = after
						? incoming.filter((entry) => entry.rkey > after)
						: [];
					const older = after
						? incoming.filter((entry) => entry.rkey <= after)
						: incoming;
					const merge =
						(add: readonly MessageView[]) => (list: readonly MessageView[]) =>
							insertSorted(
								list.filter((entry) => !keys.has(entry.rkey)),
								add,
							);
					setMessages(merge(older));
					if (newer.length > 0) editLatest(merge(newer));
				},
				createThread: async (input) => {
					const created = await source.createThread({
						community: communityOfRef(ref),
						channel: ref,
						name: input.name,
						anchor: input.anchor,
					});
					upsertThread(created);
					return created;
				},
				typing: typingSet,
				send: async (input) => {
					const rkey = nextTid();
					const parentAuthor = input.parent
						? untrack(messages).find((message) => message.rkey === input.parent)
								?.author.did
						: undefined;
					const files = input.files ?? [];
					const issued = outbox.enqueue({
						t: "send",
						channel: ref,
						rkey,
						text: input.text,
						...(input.facets ? { facets: input.facets } : {}),
						...(input.parent ? { parent: input.parent } : {}),
						...(parentAuthor ? { parentAuthor } : {}),
						...(input.attachments?.length
							? { attachments: input.attachments }
							: {}),
						...(input.suppressedEmbeds?.length
							? { suppressedEmbeds: input.suppressedEmbeds }
							: {}),
						files: files.map((file) => ({
							file: file.file,
							...(file.spoiler ? { spoiler: true } : {}),
							...(file.alt ? { alt: file.alt } : {}),
						})),
					});
					const entry: PendingMessage = {
						nonce: outboxNonce(issued.seq),
						rkey,
						channel: ref,
						text: input.text,
						facets: input.facets,
						parent: input.parent,
						attachments: input.attachments,
						...(input.suppressedEmbeds?.length
							? { suppressedEmbeds: input.suppressedEmbeds }
							: {}),
						uploads: files.length
							? files.map((file, index) => ({
									id: `${index}`,
									file: file.file,
									previewSrc: file.previewSrc,
									...(file.spoiler ? { spoiler: true } : {}),
									...(file.alt ? { alt: file.alt } : {}),
									progress: 0,
								}))
							: undefined,
						createdAt: new Date().toISOString(),
						state: "pending",
					};
					sentNonces.set(rkey, entry.nonce);
					setPending((list) => [...list, entry]);
					putSummary(summarizePending(entry, viewer.did));
					await issued.settled.catch(() => undefined);
				},
				retry: async (nonce) => {
					const seq = outboxSeq(nonce);
					if (seq === undefined) return;
					patchPending(nonce, (item) => ({
						...item,
						state: "pending",
						uploads: item.uploads?.map((upload) => ({
							...upload,
							failed: false,
						})),
					}));
					outbox.retry(seq);
				},
				discard: (nonce) => {
					const discarded = untrack(pending).find(
						(entry) => entry.nonce === nonce,
					);
					const seq = outboxSeq(nonce);
					if (discarded) discardedSends.set(discarded.rkey, "waiting");
					if (seq !== undefined) outbox.discard(seq);
					dropPending(nonce);
					if (discarded && lastMessages[ref]?.rkey === discarded.rkey)
						void loadSummaries(community, ref);
				},
				edit: async (rkey, text, facets) => {
					const previous = untrack(messages).find(
						(message) => message.rkey === rkey,
					);
					const queued = untrack(pending).find((entry) => entry.rkey === rkey);
					if (queued) {
						patchPending(queued.nonce, (entry) => ({ ...entry, text, facets }));
						replaceSummary(
							rkey,
							summarizePending({ ...queued, text, facets }, viewer.did),
						);
					}
					if (previous) {
						const next: MessageView = {
							...previous,
							text,
							updatedAt: new Date().toISOString() as MessageView["updatedAt"],
						};
						if (facets?.length) next.facets = facets;
						else delete next.facets;
						upsert(next);
						replaceSummary(rkey, summarizeMessage(next));
					}
					const issued = outbox.enqueue({
						t: "edit",
						channel: ref,
						rkey,
						text,
						...(facets?.length ? { facets } : {}),
					});
					void issued.settled.then(
						(result) => {
							if (result.message && !queued) {
								upsert(result.message);
								replaceSummary(rkey, summarizeMessage(result.message));
							}
						},
						(thrown: unknown) => {
							if (previous) {
								upsert(previous);
								replaceSummary(rkey, summarizeMessage(previous));
							}
							reportWriteFailure("edit", thrown);
						},
					);
				},
				remove: async (rkey) => {
					const previous = untrack(messages).find(
						(message) => message.rkey === rkey,
					);
					const drop = (list: readonly MessageView[]) =>
						list.filter((entry) => entry.rkey !== rkey);
					setMessages(drop);
					editLatest(drop);
					const wasLatest = lastMessages[ref]?.rkey === rkey;
					if (wasLatest) {
						const fallback = (untrack(gap)?.latest ?? untrack(messages)).at(-1);
						if (fallback) summaries.put(ref, summarizeMessage(fallback));
						else summaries.remove(ref);
					}
					const issued = outbox.enqueue({ t: "delete", channel: ref, rkey });
					void issued.settled.then(
						() => {
							if (wasLatest) void loadSummaries(community, ref);
						},
						(thrown: unknown) => {
							if (previous) upsert(previous);
							if (wasLatest && previous) putSummary(summarizeMessage(previous));
							else if (wasLatest) void loadSummaries(community, ref);
							reportWriteFailure("delete", thrown);
						},
					);
				},
				setHidden: async (rkey, hidden) => {
					const message = await source.setHidden({
						channel: ref,
						rkey,
						hidden,
					});
					upsert(message);
				},
				setSuppressedEmbeds: async (rkey, uris, as) => {
					const input = { channel: ref, rkey, uris };
					const message =
						as === "author"
							? await source.setSuppressedEmbeds(input)
							: await source.setModeratedEmbeds(input);
					upsert(message);
				},
				react: async (rkey, emoji, add, customEmoji) => {
					const author = untrack(messages).find(
						(message) => message.rkey === rkey,
					)?.author.did;
					if (!author) return;
					applyReaction(rkey, emoji, viewer.did, add, customEmoji);
					const key = `${ref}\n${rkey}\n${emoji}`;
					const reaction = add ? nextTid() : reactionKeys.get(key);
					if (add && reaction) reactionKeys.set(key, reaction);
					else reactionKeys.delete(key);
					const issued = outbox.enqueue({
						t: "react",
						channel: ref,
						rkey,
						emoji,
						...(add && customEmoji ? { customEmoji } : {}),
						add,
						author,
						...(reaction ? { reaction } : {}),
					});
					void issued.settled.catch((thrown: unknown) => {
						applyReaction(rkey, emoji, viewer.did, !add);
						reportWriteFailure("react", thrown);
					});
				},
				markRead: () => {
					const current = unread[community]?.[skeyOf(ref)];
					const thread = untrack(() => findThread(ref));
					const behind = !!untrack(gap);
					if (
						!behind &&
						(current?.hasUnread || (thread && current?.mentions))
					) {
						setUnread(community, skeyOf(ref), {
							...current,
							hasUnread: false,
							mentions: thread ? 0 : current.mentions,
						});
					}
					if (thread) {
						markThreadSeen(ref);
						const ids = untrack(notifications.items)
							.filter((entry) => entry.thread === ref && !entry.seenAt)
							.map((entry) => entry.id);
						if (ids.length) void notifications.markRead(ids).catch(() => {});
					}
					if (!ready()) return;
					if (provisionalFrom === undefined)
						readThrough = messages().at(-1)?.rkey ?? readThrough;
					noteRead(ref, readThrough);
					void source.markRead(ref, behind ? readThrough : undefined);
				},
				clearUnreadMarker: () => setUnreadAfter(undefined),
			};

			typingStops.set(ref, stopTyping);
			channels.set(ref, data);
			const refresh = (): Promise<void> => {
				if (!untrack(ready) || opening) return Promise.resolve();
				const epoch = currentEpoch();
				return track((isCurrent) =>
					refreshFromNetwork(untrack(viewing) === ref || holds.has(ref)).then(
						() => {
							if (!isCurrent()) return;
							setOpenError(undefined);
							confirm(epoch);
						},
						(thrown: unknown) => {
							log.warn("channel refresh failed", {
								code: classifyThrown(thrown, {
									method: "channel.listMessages",
								}).code,
							});
						},
					),
				);
			};

			const catchUpStored = async () => {
				if (!cache || opening || untrack(ready)) return;
				const stored = await cache.read(ref);
				if (!stored || opening || untrack(ready)) return;
				const page = await newestSince(ref, stored.messages.at(-1)?.rkey);
				if (opening || untrack(ready)) return;
				const refreshed = refreshMessageWindow(stored.messages, page, {
					pageSize: PAGE_SIZE,
					cachedCursor: stored.cursor,
				});
				cache.offer(ref, refreshed.messages, {
					cursor: refreshed.cursor,
					hasMore: !!refreshed.cursor,
					readCursor: stored.readCursor,
				});
			};

			const start = () => {
				if (untrack(ready) || opening) return;
				if (paintFromMemory() !== "continuous") openFeed();
			};

			feedControls.set(ref, {
				ensureOpen: start,
				refresh,
				refreshIfStale: () => {
					const epoch = currentEpoch();
					const fresh =
						!isThreadSpace(ref) &&
						epoch !== undefined &&
						confirmedEpoch === epoch &&
						untrack(confirmed);
					return fresh ? Promise.resolve() : refresh();
				},
				catchUp: () =>
					untrack(ready)
						? refresh()
						: catchUpStored().catch((thrown: unknown) =>
								log.warn("cached channel catch-up failed", {
									code: classifyThrown(thrown, {
										method: "channel.listMessages",
									}).code,
								}),
							),
				evict: () => {
					if (untrack(pending).length > 0) return;
					const held = untrack(gap);
					const window = held ? held.latest : untrack(storedMessages);
					const epoch = currentEpoch();
					if (untrack(ready) && window.length > 0) {
						const kept = window.slice(-TAIL_PER_CHANNEL);
						const continuous =
							!isThreadSpace(ref) &&
							epoch !== undefined &&
							confirmedEpoch === epoch &&
							provisionalFrom === undefined &&
							untrack(confirmed);
						tails.put(ref, {
							messages: kept,
							cursor:
								kept.length < window.length
									? kept[0]?.rkey
									: held
										? held.cursor
										: untrack(cursor),
							...(kept.length < window.length
								? { after: window[window.length - kept.length - 1]?.rkey }
								: {}),
							...(continuous ? { epoch } : {}),
						});
					}
					confirmedEpoch = undefined;
					provisionalFrom = undefined;
					predecessor = undefined;
					batch(() => {
						setGap(undefined);
						setMessageList([]);
						setCursor(undefined);
						setUnreadAfter(undefined);
						setReady(false);
						setConfirmed(false);
					});
				},
			});
			if (painted !== "continuous") openFeed();
			return data;
		};

		const tailStart = (ref: SpaceRef, message: MessageView) => {
			const anchor = summaryAnchors.get(ref);
			summaryAnchors.delete(ref);
			const epoch = currentEpoch();
			if (!anchor || epoch === undefined || anchor.epoch !== epoch)
				return undefined;
			return message.rkey > anchor.rkey
				? { epoch, after: anchor.rkey }
				: undefined;
		};
		const feedTail = (event: Extract<LiveEvent, { $type: "messageEvent" }>) => {
			const ref = event.channel;
			if (event.event === "delete") {
				const rkey = event.rkey ?? event.message?.rkey;
				if (rkey) tails.remove(ref, rkey);
				return;
			}
			const message = event.message;
			if (!message) return;
			if (event.event === "update") {
				tails.update(ref, message);
				return;
			}
			tails.append(
				ref,
				message,
				tails.has(ref) ? undefined : tailStart(ref, message),
			);
		};

		source.subscribe((event) => {
			switch (event.$type) {
				case "messageEvent": {
					if (event.event === "create" && event.message) {
						markUnread(event.message);
						typingStops.get(event.channel)?.(event.message.author.did);
						putSummary(summarizeMessage(event.message));
					}
					if (event.event === "update" && event.message) {
						const current = lastMessages[event.channel];
						if (current?.rkey === event.message.rkey) {
							summaries.put(event.channel, summarizeMessage(event.message));
						}
					}
					if (event.event === "delete") {
						const rkey = event.rkey ?? event.message?.rkey;
						const current = lastMessages[event.channel];
						if (current && current.rkey === rkey) {
							void loadSummaries(communityOfRef(event.channel), event.channel);
						}
					}
					if (!messageListeners.get(event.channel)?.(event)) feedTail(event);
					return;
				}
				case "reactionEvent":
					if (!messageListeners.get(event.channel)?.(event))
						tails.react(event.channel, {
							rkey: event.target,
							emoji: event.emoji,
							customEmoji: event.customEmoji,
							actor: event.actor,
							add: event.event === "create",
							viewer: viewer.did,
						});
					return;
				case "typingEvent":
					typingListeners.get(event.channel)?.(event.did);
					return;
				case "presenceEvent":
					seededPresence.delete(event.did);
					presences.put(event.did, event.presence);
					if (!event.presence.voice) setSpeaking(event.did, false);
					return;
				case "voiceActivityEvent":
					setSpeaking(event.did, event.speaking);
					return;
				case "voiceStateEvent":
					applyVoiceState(event.did, event.channel, event.voice);
					return;
				case "viewerEvent":
					applyViewer(event.profile);
					return;
				case "seenEvent":
					if (event.channel) markThreadSeen(event.channel);
					return;
				case "notificationEvent":
					return;
			}
		});

		const applyVoiceState = (
			did: Did,
			channel: SpaceRef,
			voice: VoiceState | undefined,
		) => {
			presences.update(did, (current) => {
				if (voice) return { onlineState: "online", ...current, voice };
				if (current?.voice?.channel !== channel) return current;
				const { voice: _left, ...rest } = current;
				return rest;
			});
		};

		const applyViewer = (next: ProfileView) => {
			const { presence: nextPresence, ...profile } = next;
			setViewer(reconcile({ ...profile, presence: viewer.presence }));
			const known = untrack(() => presence[next.did]);
			if (nextPresence && (!known || seededPresence.has(next.did))) {
				seededPresence.delete(next.did);
				presences.put(next.did, nextPresence);
			}
			for (const load of memberLoads.values()) {
				load.update((list) =>
					list.map((member) =>
						member.actor.did === next.did
							? {
									...member,
									actor: {
										...member.actor,
										preferredBadge: undefined,
										...profile,
									},
								}
							: member,
					),
				);
			}
		};

		const uploadImage = async (
			file: File | null | undefined,
			onProgress: (fraction: number) => void,
		) => {
			if (!file) return file;
			return source.uploadBlob(file, { onProgress });
		};

		const saveProfile = async (
			draft: ProfileDraft,
			options: { onProgress?: (progress: ProfileSaveProgress) => void } = {},
		) => {
			const progress: ProfileSaveProgress = {};
			const report =
				(part: keyof ProfileSaveProgress) => (fraction: number) => {
					progress[part] = fraction;
					options.onProgress?.({ ...progress });
				};
			const synced = draft.syncBluesky;
			const pronouns = draft.pronouns?.trim();
			const [avatar, banner] = await Promise.all([
				synced ? undefined : uploadImage(draft.avatar, report("avatar")),
				synced ? undefined : uploadImage(draft.banner, report("banner")),
			]);
			const next = await source.putProfile({
				syncBluesky: synced,
				displayName: synced ? undefined : draft.displayName.trim(),
				description: synced ? undefined : draft.description.trim(),
				pronouns: synced && pronouns === "" ? null : pronouns,
				avatar,
				banner,
				theme: draft.theme,
				...(draft.preferredBadge !== undefined
					? { preferredBadge: draft.preferredBadge }
					: {}),
			});
			applyViewer(next);
		};

		const setStatus = async (input: StatusInput) => {
			const next = await source.setStatus(input);
			presences.put(viewer.did, next);
		};

		const setVoice = async (voice: VoiceState | undefined) => {
			const current = presence[viewer.did];
			const previous = current ? { ...current } : undefined;
			const optimistic: Presence = {
				...(previous ?? { onlineState: "online" }),
			};
			if (voice) optimistic.voice = voice;
			else delete optimistic.voice;
			presences.put(viewer.did, optimistic);
			try {
				const next = await source.setVoice(voice);
				presences.put(viewer.did, next);
			} catch (error) {
				presences.put(viewer.did, previous ?? { onlineState: "online" });
				throw error;
			}
		};

		const setOnlineState = async (onlineState: Presence["onlineState"]) => {
			const current = presence[viewer.did];
			const previous = current ? { ...current } : undefined;
			presences.put(viewer.did, { ...(current ?? {}), onlineState });
			try {
				const next = await source.setStatus({ onlineState });
				presences.put(viewer.did, next);
			} catch (error) {
				if (previous) presences.put(viewer.did, previous);
				throw error;
			}
		};

		const moveMessages = async (input: {
			source: SpaceRef;
			destination: SpaceRef;
			messages: readonly MessageView[];
		}) => {
			const rkeys = input.messages.map((message) => message.rkey);
			const from = channels.get(input.source);
			const to = channels.get(input.destination);
			const removed = from?.detach(rkeys) ?? [];
			const moving = removed.length > 0 ? removed : input.messages;
			to?.attach(moving);
			try {
				return await source.moveMessages({
					source: input.source,
					destination: input.destination,
					subjects: input.messages.map((message) => ({
						did: message.author.did,
						collection: MESSAGE_COLLECTION,
						rkey: message.rkey,
					})),
				});
			} catch (error) {
				to?.detach(rkeys);
				from?.attach(moving);
				throw error;
			}
		};

		const emojiStore = createEmojiStore(
			source,
			() => viewer.did,
			() => communities.value() ?? [],
			{
				seed: snapshot?.emoji,
				offer: (emoji) => spaceCache?.offerEmoji(emoji),
			},
		);

		const backfill = createCatchUpQueue();
		onCleanup(backfill.cancel);
		let lastCatchUp = Number.NEGATIVE_INFINITY;
		const catchUp = () => {
			resumes += 1;
			const now = Date.now();
			if (now - lastCatchUp < CATCH_UP_SPACING_MS) return;
			lastCatchUp = now;
			backfill.cancel();
			const shown = new Set<SpaceRef>(holds.keys());
			const current = untrack(viewing);
			if (current) shown.add(current);
			for (const ref of shown) {
				void feedControls.get(ref)?.refresh();
				void threadLoads.get(ref)?.refresh();
			}
			void communities.refresh();
			void source.preferences.refresh();
			void emojiStore.library().refresh();
			for (const community of spaces.keys()) {
				void loadUnread(community);
				void loadSummaries(community);
				void categoryLoads.get(community)?.refresh();
				void channelLoads.get(community)?.refresh();
			}
			void notifications.refresh();
			const queued: CatchUpTask[] = [];
			for (const [ref, control] of [...feedControls].reverse()) {
				if (!shown.has(ref)) queued.push(control.catchUp);
			}
			for (const [ref, load] of threadLoads) {
				if (!shown.has(ref)) queued.push(load.refresh);
			}
			for (const [community, roles] of roleLoads) {
				queued.push(() => roles.refresh().then(() => syncViewer(community)));
			}
			for (const members of memberLoads.values()) queued.push(members.refresh);
			void backfill.run(queued);
		};

		const bootReady = createMemo(() => {
			const list = communities.value();
			if (!list) return false;
			const key = lastSpace();
			const current = key
				? list.find((entry) => spaceKey(entry) === key)
				: undefined;
			if (current) {
				const data = runWithOwner(owner, () => space(current));
				if (
					!data ||
					data.channels.value() === undefined ||
					data.categories.value() === undefined
				)
					return false;
			}
			const ref = viewing();
			const feed = ref ? channels.get(ref) : undefined;
			return !feed || feed.ready();
		});

		const accessStore = createAccessStore({ source, memberLoads });
		const legacy = createLegacyCommunities({
			source,
			onMigrated: () => communities.refresh(),
		});
		onCleanup(legacy.dispose);
		const store = {
			legacy,
			access: {
				...accessStore,
				join: async (community: Did, invitation?: string) => {
					const result = await accessStore.join(community, invitation);
					if (result.status === "joined") await communities.refresh();
					return result;
				},
			},
			emoji: emojiStore,
			moveMessages,
			viewer,
			saveProfile,
			setStatus,
			setOnlineState,
			notifications,
			spaceNotifications,
			jumps,
			threads: threadActions,
			threadsOf,
			cachedThreads: (ref: SpaceRef): readonly ThreadView[] | undefined =>
				threadLoads.get(ref)?.peek?.(),
			threadMembersOf,
			channels: channelActions,
			categories: categoryActions,
			community: communityActions,
			communities,
			directory: createSpaceDirectory(source, communities),
			space,
			channel,
			spaceByKey: (slug: string) =>
				communities.value()?.find((entry) => spaceKey(entry) === slug),
			presenceOf: (did: Did) => presence[did],
			inVoice: (channel: string): readonly Did[] =>
				voiceRoster().get(channel) ?? [],
			isSpeaking: (did: Did) => !!speaking[did],
			setVoice,
			nonceFor: (rkey: string) => sentNonces.get(rkey),
			peekMessage: (ref: SpaceRef, rkey: string): MessageView | undefined =>
				channels
					.get(ref)
					?.messages()
					.find((entry) => entry.rkey === rkey),
			forward: (input: ForwardInput): Promise<unknown> => {
				const message = untrack(() =>
					channels.get(input.from)?.messages(),
				)?.find((entry) => entry.rkey === input.rkey);
				const issued = outbox.enqueue({
					t: "forward",
					from: input.from,
					rkey: input.rkey,
					to: input.to,
					...(input.text !== undefined ? { text: input.text } : {}),
					forwardRkey: nextTid(),
					...(message ? { message } : {}),
				});
				return issued.settled;
			},
			outbox: {
				pendingCount: outbox.pendingCount,
				flush: outbox.flush,
				drain: outbox.drain,
			},
			onWriteFailed: (listener: (failure: WriteFailure) => void) => {
				writeFailureListeners.add(listener);
				return () => writeFailureListeners.delete(listener);
			},
			viewing,
			setViewing: (ref?: SpaceRef) => {
				if (ref) threadOpenedAt.put(ref, clock());
				setViewing(ref);
			},
			holdChannel,
			lastChannel,
			lastSpace: () => lastSpace(),
			bootReady,
			lastMessage: (ref: SpaceRef) => lastMessages[ref],
			setLastChannel,
			rememberedThread,
			rememberThread,
			isMuted: (ref: SpaceRef) =>
				source.preferences.isMuted(muteSubjectOf(ref)),
			setMuted: (ref: SpaceRef, muted: boolean) => {
				void source.preferences.setMuted(muteSubjectOf(ref), muted);
			},
			preferences: source.preferences,
			controls: source.preferences.controls,
			source,
			simulation: () => simulation(),
			setSimulation: (next: Partial<Simulation>) => {
				source.setSimulation(next);
				setSimulationSignal(source.simulation());
				outbox.flush();
			},
			setControls: source.preferences.setControls,
			typing: (ref: SpaceRef) => source.typing(ref),
			catchUp,
			pauseCatchUp: backfill.cancel,
			dispose: () => {
				tails.clear();
				summaryAnchors.clear();
				outbox.dispose();
				dispose();
			},
		};
		connectVoice(store);
		return store;
	});

export type DataStore = ReturnType<typeof createDataStore>;

export const DataContext = createContext<DataStore>();

const muteSubjectOf = (ref: SpaceRef): MuteSubject =>
	isThreadSpace(ref)
		? { kind: "thread", thread: ref }
		: { kind: "channel", channel: ref };

export const useData = () => {
	const store = useContext(DataContext);
	if (!store) throw new Error("useData needs a DataContext provider");
	return store;
};
