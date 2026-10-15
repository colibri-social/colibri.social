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
import { createStore, produce, reconcile } from "solid-js/store";
import { createAccessStore } from "./access-store";
import { normalizeChannelLayout, sameChannel } from "./channel-layout";
import {
	type ChannelSummary,
	newerSummary,
	summarizeMessage,
} from "./channel-summary";
import { DEVICE_KEYS, deviceString } from "./device-prefs";
import { createEmojiStore } from "./emoji-store";
import { channelSlug, isVoiceChannel, skeyOf, spaceKey } from "./ids";
import { createJumpRequests } from "./jump";
import { keepUnchanged } from "./merge";
import type { MessageCache } from "./message-cache";
import {
	createNotificationStore,
	createSpaceNotificationPrefs,
} from "./notifications";
import { readStored, writeStored } from "./persist";
import { orderCommunities } from "./preferences/order";
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
	RoleView,
	SpaceRef,
	ThreadView,
	VoiceState,
} from "./types";
import { documentVisible } from "./visibility";
import { connectVoice } from "./voice";

const PAGE_SIZE = 60;
const UNREAD_SEARCH_LIMIT = 400;
const CATCH_UP_PAGES = 4;
const CATCH_UP_SPACING_MS = 1_000;
const TYPING_MS = 6000;

const log = createLogger("store");

export type ProfileDraft = {
	displayName: string;
	description: string;
	avatar?: File | null;
	banner?: File | null;
	syncBluesky: boolean;
	theme?: ProfileTheme;
};

export type ProfileSaveProgress = { avatar?: number; banner?: number };

export type Load<T> = {
	value: Accessor<T | undefined>;
	loading: Accessor<boolean>;
	error: Accessor<ColibriError | undefined>;
	retry: () => void;
};

type MutableLoad<T> = Load<T> & {
	update: (change: (current: T) => T) => void;
	refresh: () => Promise<void>;
	peek?: () => T | undefined;
};

export type UnreadState = { hasUnread: boolean; mentions: number };

export type PendingMessage = {
	nonce: string;
	rkey: string;
	channel: SpaceRef;
	text: string;
	facets?: Facet[];
	parent?: string;
	attachments?: AttachmentView[];
	uploads?: PendingUpload[];
	createdAt: string;
	state: "pending" | "failed";
};

export type PendingUpload = {
	id: string;
	file: File;
	previewSrc?: string;
	spoiler?: boolean;
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
	loadError: Accessor<ColibriError | undefined>;
	reload: () => void;
	hasOlder: Accessor<boolean>;
	loadingOlder: Accessor<boolean>;
	loadOlder: () => void;
	hasNewer: Accessor<boolean>;
	loadingNewer: Accessor<boolean>;
	loadNewer: () => void;
	jumpToLatest: () => void;
	unreadAfter: Accessor<string | undefined>;
	enter: (fresh: boolean) => string | undefined;
	threads: Load<ThreadView[]>;
	typing: Accessor<readonly Did[]>;
	send: (input: {
		text: string;
		facets?: Facet[];
		parent?: string;
		attachments?: AttachmentView[];
		files?: { file: File; previewSrc?: string; spoiler?: boolean }[];
	}) => Promise<void>;
	retry: (nonce: string) => Promise<void>;
	discard: (nonce: string) => void;
	edit: (rkey: string, text: string, facets?: Facet[]) => Promise<void>;
	remove: (rkey: string) => Promise<void>;
	react: (rkey: string, emoji: string, add: boolean) => Promise<void>;
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
		return request.then(
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
	};
	void run(seed !== undefined);
	const update = (change: (current: T) => T) =>
		setValue((current) => (current === undefined ? current : change(current)));
	const retry = () => {
		if (!loading()) void run();
	};
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
		retry: () => ensure().retry(),
		update: (change) => inner?.update(change),
		refresh: () => inner?.refresh() ?? Promise.resolve(),
		peek: () => (started() ? inner?.value() : undefined),
	};
};

let nonceCounter = 0;
const nextNonce = () => `local-${Date.now().toString(36)}-${nonceCounter++}`;

type ChannelWatcher = {
	watchChannel: (channel: SpaceRef) => () => void;
	viewChannel: (channel?: SpaceRef) => void;
};

const watchesChannels = (
	source: DataSource,
): source is DataSource & ChannelWatcher =>
	typeof (source as Partial<ChannelWatcher>).watchChannel === "function" &&
	typeof (source as Partial<ChannelWatcher>).viewChannel === "function";

export type DataStoreOptions = { cache?: MessageCache; spaces?: SpaceCache };

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
			for (const key of Object.keys(viewer))
				profile[key] = viewer[key as keyof ProfileView];
			if (viewer.did) spaceCache?.offerViewer(profile as ProfileView);
		});
		const spaces = new Map<Did, SpaceData>();
		const [lastMessages, setLastMessages] = createStore<
			Record<string, ChannelSummary | undefined>
		>({});
		const putSummary = (summary: ChannelSummary) => {
			if (newerSummary(lastMessages[summary.channel], summary)) {
				setLastMessages(summary.channel, summary);
			}
		};
		const loadSummaries = (community: Did, only?: SpaceRef): Promise<void> =>
			source.listChannelSummaries(community).then(
				(list) => {
					const seen = new Set<string>();
					for (const summary of list) {
						seen.add(summary.channel);
						if (only && summary.channel !== only) continue;
						if (only) setLastMessages(summary.channel, summary);
						else putSummary(summary);
					}
					if (only && !seen.has(only)) setLastMessages(only, undefined);
				},
				(thrown: unknown) =>
					log.warn("channel summaries failed", {
						code: classifyThrown(thrown, { method: "channel.listSummaries" })
							.code,
					}),
			);
		const syncViewer = (community: Did, viewerRoles?: readonly string[]) => {
			const list = roleLoads.get(community)?.value();
			if (!list) return;
			communities.update((views) =>
				views.map((view) =>
					view.did === community ? viewerFrom(view, list, viewerRoles) : view,
				),
			);
		};
		source.subscribe((event) => {
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
					syncViewer(event.community, event.roles);
				}
			}
		});
		const channels = new Map<SpaceRef, ChannelData>();
		const feedControls = new Map<
			SpaceRef,
			{
				ensureOpen: () => void;
				refresh: () => Promise<void>;
				catchUp: () => Promise<void>;
				evict: () => void;
			}
		>();
		const cache = options.cache;
		const recentFeeds = createLru<true>(MEMORY_WINDOW_COUNT);
		const [presence, setPresence] = createStore<Record<string, Presence>>({});
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
		const [unread, setUnread] = createStore<
			Record<string, Record<string, UnreadState>>
		>(seededUnread(snapshot));
		const [viewing, setViewing] = createSignal<SpaceRef>();
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
				if (watching) void feedControls.get(ref)?.refresh();
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
					const release = holdChannel(ref);
					source.viewChannel(ref);
					onCleanup(() => {
						source.viewChannel(undefined);
						release();
					});
				}),
			);
		}
		const [lastChannels, setLastChannels] = createStore<
			Record<string, string | undefined>
		>({});
		const [lastSpace, setLastSpace] = deviceString(DEVICE_KEYS.lastSpace);
		const lastChannel = (space: string) =>
			lastChannels[space] ?? readStored(DEVICE_KEYS.lastChannel(space));
		const setLastChannel = (space: string, channel: string) => {
			setLastChannels(space, channel);
			setLastSpace(space);
			writeStored(DEVICE_KEYS.lastChannel(space), channel);
		};
		const [mutedThreads, setMutedThreads] = createSignal<ReadonlySet<string>>(
			new Set(),
		);
		const typingListeners = new Map<SpaceRef, (did: Did) => void>();
		const typingStops = new Map<SpaceRef, (did: Did) => void>();
		const sentNonces = new Map<string, string>();
		const messageListeners = new Map<SpaceRef, (event: LiveEvent) => void>();
		const notifications = createNotificationStore(source, (views, seen) => {
			const counts = new Map<SpaceRef, number>();
			for (const view of views) {
				if (view.thread || !view.message) continue;
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
			untrack(viewing) === ref && untrack(documentVisible);
		const loadUnread = (community: Did): Promise<void> =>
			source.listUnreadStatus(community).then(
				(statuses) => {
					const entries: Record<string, UnreadState> = {};
					for (const status of statuses) {
						const slug = skeyOf(status.channel);
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
					setUnread(community, reconcile(entries));
				},
				(thrown: unknown) =>
					log.warn("unread status failed", {
						code: classifyThrown(thrown, { method: "unread.list" }).code,
					}),
			);

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
					setPresence(
						produce((draft) => {
							for (const member of all) {
								const current = member.actor.presence;
								if (current && !draft[member.actor.did]) {
									draft[member.actor.did] = current;
								}
							}
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
				};
				spaceCache?.offerSpace(community.did, patch);
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
			setUnread(community, (entries) => ({
				...entries,
				[slug]: { ...current, hasUnread: true },
			}));
		};

		const countedNotifications = new Set<string>();
		source.subscribe((event) => {
			if (event.$type !== "notificationEvent") return;
			const view = event.notification;
			if (view.thread || view.seenAt) return;
			if (countedNotifications.has(view.id)) return;
			countedNotifications.add(view.id);
			const community = communityOfRef(view.channel);
			const slug = skeyOf(view.channel);
			const current = unread[community]?.[slug];
			setUnread(community, (entries) => ({
				...entries,
				[slug]: {
					hasUnread: viewing() !== view.channel || !!current?.hasUnread,
					mentions: (current?.mentions ?? 0) + 1,
				},
			}));
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

		const threadActions = {
			find: findThread,
			rename: (thread: ThreadView, name: string) =>
				patchThread(thread, { ...thread, name: name.trim() }, () =>
					source.updateThread({ thread: thread.space, name: name.trim() }),
				),
			follow: (thread: ThreadView, follow: boolean) =>
				patchThread(
					thread,
					{ ...thread, viewer: { ...thread.viewer, following: follow } },
					() => source.followThread({ thread: thread.space, follow }),
				),
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
					await source.deleteThread({ thread: thread.space });
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

		const dropChannel = (community: Did, space: SpaceRef) => {
			cache?.forget(space);
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
						? { ...entry, ...view, channels: entry.channels }
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
			spaceCache?.forgetCommunity(community);
			communities.update((list) =>
				list.filter((entry) => entry.did !== community),
			);
			const ids = unseenInCommunity(community);
			if (ids.length) void notifications.markRead(ids).catch(() => {});
		};

		source.subscribe((event) => {
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
			transferOwnership: (community: Did, subject: Did) =>
				source.transferOwnership({ community, subject }),
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
					if (unread[community]?.[slug]?.hasUnread) {
						setUnread(community, slug, "hasUnread", false);
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

			const [messages, setMessageList] = createSignal<readonly MessageView[]>(
				[],
			);
			const [pending, setPending] = createSignal<readonly PendingMessage[]>([]);
			const [ready, setReady] = createSignal(false);
			const [openError, setOpenError] = createSignal<ColibriError>();
			let opening = false;
			const [cursor, setCursor] = createSignal<string>();
			const [loadingOlder, setLoadingOlder] = createSignal(false);
			const [unreadAfter, setUnreadAfter] = createSignal<string>();
			const [gap, setGap] = createSignal<FeedGap>();
			const [loadingNewer, setLoadingNewer] = createSignal(false);
			const [typingSet, setTypingSet] = createSignal<readonly Did[]>([]);
			const typingTimers = new Map<Did, ReturnType<typeof setTimeout>>();
			const community = communityOfRef(ref);
			let readThrough: string | undefined;
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
			const setMessages = (
				next:
					| readonly MessageView[]
					| ((current: readonly MessageView[]) => readonly MessageView[]),
			) => {
				setMessageList(next as never);
				remember();
			};

			const paint = (window: {
				messages: MessageView[];
				cursor?: string;
				readCursor?: string;
			}) =>
				batch(() => {
					setMessageList(window.messages);
					setCursor(window.cursor);
					readThrough = window.readCursor ?? readThrough;
					setReady(true);
				});

			const remembered = cache?.recall(ref);
			if (remembered) paint(remembered);

			const refreshFromNetwork = async (keepPlace = false) => {
				const held = untrack(gap);
				const newestKnown = (held ? held.latest : untrack(messages)).at(
					-1,
				)?.rkey;
				const [statuses, page] = await Promise.all([
					source.listUnreadStatus(community),
					newestSince(ref, newestKnown),
				]);
				const status = statuses.find((entry) => entry.channel === ref);
				readThrough = status?.cursor ?? readThrough;
				const current = untrack(gap);
				if (current) {
					const merged = refreshMessageWindow(current.latest, page, {
						pageSize: PAGE_SIZE,
						cachedCursor: current.cursor,
					});
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
				const refreshed = refreshMessageWindow(untrack(messages), page, {
					pageSize: PAGE_SIZE,
					cachedCursor: untrack(cursor),
				});
				batch(() => {
					setCursor(refreshed.cursor);
					setMessages(refreshed.messages);
				});
			};

			const open = async () => {
				if (!untrack(ready) && cache) {
					const stored = await cache.read(ref);
					if (stored && !untrack(ready)) paint(stored);
				}
				if (untrack(ready) && untrack(messages).length > 0) {
					await refreshFromNetwork();
					return;
				}
				const statuses = await source.listUnreadStatus(community);
				const status = statuses.find((entry) => entry.channel === ref);
				const readCursor = status?.hasUnread ? status.cursor : undefined;
				let collected: MessageView[] = [];
				let next: string | undefined;
				do {
					const page = await source.listMessages({
						channel: ref,
						limit: PAGE_SIZE,
						cursor: next,
					});
					collected = [...page.items.slice().reverse(), ...collected];
					next = page.cursor;
					if (
						!readCursor ||
						collected.some((message) => message.rkey <= readCursor) ||
						collected.length >= UNREAD_SEARCH_LIMIT
					) {
						break;
					}
				} while (next);
				const firstUnread = readCursor
					? collected.find((message) => message.rkey > readCursor)
					: undefined;
				readThrough = status?.cursor ?? collected.at(-1)?.rkey;
				batch(() => {
					setMessages(collected);
					setCursor(next);
					setUnreadAfter(
						firstUnread
							? collected[collected.indexOf(firstUnread) - 1]?.rkey
							: undefined,
					);
					setReady(true);
				});
				remember();
			};

			const openFeed = () => {
				if (opening) return;
				opening = true;
				setOpenError(undefined);
				open().then(
					() => {
						opening = false;
					},
					(thrown: unknown) => {
						opening = false;
						const failure = classifyThrown(thrown, {
							method: "channel.listMessages",
						});
						log.warn("channel open failed", { code: failure.code });
						setOpenError(failure);
					},
				);
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

			const jumpToLatest = () => {
				const held = untrack(gap);
				if (!held) return;
				batch(() => {
					setGap(undefined);
					setCursor(held.cursor);
					setMessages(held.latest);
				});
			};

			const upsert = (message: MessageView) => {
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

			const settlePending = (nonce: string, message: MessageView) => {
				const settled = pending().find((entry) => entry.nonce === nonce);
				batch(() => {
					if (settled) {
						setPending((list) => list.filter((entry) => entry.nonce !== nonce));
					}
					upsert(message);
				});
				if (settled) revokePreviews(settled);
			};

			const settleEcho = (message: MessageView) => {
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

			const uploadAll = async (entry: PendingMessage) => {
				const uploads = entry.uploads ?? [];
				const results = await Promise.all(
					uploads.map(async (upload) => {
						if (upload.attachment) return upload.attachment;
						patchUpload(entry.nonce, upload.id, { failed: false, progress: 0 });
						try {
							const uploaded = await source.uploadBlob(upload.file, {
								onProgress: (progress) =>
									patchUpload(entry.nonce, upload.id, { progress }),
							});
							const attachment: AttachmentView = upload.spoiler
								? { ...uploaded, spoiler: true }
								: uploaded;
							patchUpload(entry.nonce, upload.id, { attachment, progress: 1 });
							return attachment;
						} catch {
							patchUpload(entry.nonce, upload.id, { failed: true });
							return undefined;
						}
					}),
				);
				if (results.some((result) => !result)) return undefined;
				return results as AttachmentView[];
			};

			const revokePreviews = (entry: PendingMessage) => {
				for (const upload of entry.uploads ?? []) {
					if (upload.previewSrc?.startsWith("blob:")) {
						URL.revokeObjectURL(upload.previewSrc);
					}
				}
			};

			const deliver = async (entry: PendingMessage) => {
				const markFailed = () =>
					patchPending(entry.nonce, (item) => ({ ...item, state: "failed" }));
				const uploaded = await uploadAll(entry);
				if (!uploaded) {
					markFailed();
					return;
				}
				sentNonces.set(entry.rkey, entry.nonce);
				try {
					const message = await source.sendMessage({
						channel: ref,
						rkey: entry.rkey,
						text: entry.text,
						facets: entry.facets,
						parent: entry.parent,
						attachments: [...(entry.attachments ?? []), ...uploaded],
					});
					sentNonces.set(message.rkey, entry.nonce);
					settlePending(entry.nonce, message);
				} catch {
					markFailed();
				}
			};

			const applyReaction = (
				rkey: string,
				emoji: string,
				actor: Did,
				add: boolean,
			) => {
				const react = (list: readonly MessageView[]) =>
					list.map((message) => {
						if (message.rkey !== rkey) return message;
						const reactions = message.reactions.slice();
						const index = reactions.findIndex((entry) => entry.emoji === emoji);
						const current = reactions[index];
						if (add) {
							if (current?.reactors.includes(actor)) return message;
							const next = current
								? {
										...current,
										count: current.count + 1,
										reactors: [...current.reactors, actor],
									}
								: { emoji, count: 1, reactors: [actor] };
							if (actor === viewer.did) next.viewerReacted = true;
							if (current) reactions[index] = next;
							else reactions.push(next);
						} else {
							if (!current?.reactors.includes(actor)) return message;
							const next = {
								...current,
								count: current.count - 1,
								reactors: current.reactors.filter((did) => did !== actor),
								viewerReacted:
									actor === viewer.did ? false : current.viewerReacted,
							};
							if (next.count <= 0) reactions.splice(index, 1);
							else reactions[index] = next;
						}
						return { ...message, reactions };
					});
				setMessages(react);
				editLatest(react);
			};

			messageListeners.set(ref, (event) => {
				if (event.$type === "messageEvent") {
					if (event.event === "delete" && event.rkey) {
						const rkey = event.rkey;
						const drop = (list: readonly MessageView[]) =>
							list.filter((entry) => entry.rkey !== rkey);
						setMessages(drop);
						editLatest(drop);
						return;
					}
					if (!event.message) return;
					if (settleEcho(event.message)) return;
					if (ready()) upsert(event.message);
					return;
				}
				if (event.$type === "reactionEvent") {
					applyReaction(
						event.target,
						event.emoji,
						event.actor,
						event.event === "create",
					);
				}
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
				loadError: openError,
				reload: () => {
					if (!ready()) openFeed();
				},
				hasOlder: () => !!cursor(),
				hasNewer: () => !!gap(),
				loadingNewer,
				loadNewer,
				jumpToLatest,
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
					setUnreadAfter(list[first - 1]?.rkey);
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
					const entry: PendingMessage = {
						nonce: nextNonce(),
						rkey: nextTid(),
						channel: ref,
						text: input.text,
						facets: input.facets,
						parent: input.parent,
						attachments: input.attachments,
						uploads: input.files?.map((file, index) => ({
							id: `${index}`,
							file: file.file,
							previewSrc: file.previewSrc,
							...(file.spoiler ? { spoiler: true } : {}),
							progress: 0,
						})),
						createdAt: new Date().toISOString(),
						state: "pending",
					};
					setPending((list) => [...list, entry]);
					await deliver(entry);
				},
				retry: async (nonce) => {
					const entry = pending().find((item) => item.nonce === nonce);
					if (!entry) return;
					const next = { ...entry, state: "pending" as const };
					setPending((list) =>
						list.map((item) => (item.nonce === nonce ? next : item)),
					);
					await deliver(next);
				},
				discard: (nonce) => {
					const entry = pending().find((item) => item.nonce === nonce);
					if (entry) revokePreviews(entry);
					setPending((list) => list.filter((item) => item.nonce !== nonce));
				},
				edit: async (rkey, text, facets) => {
					const message = await source.editMessage({
						channel: ref,
						rkey,
						text,
						facets,
					});
					upsert(message);
				},
				remove: async (rkey) => {
					setMessages((list) => list.filter((entry) => entry.rkey !== rkey));
					await source.deleteMessage({ channel: ref, rkey });
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
				react: async (rkey, emoji, add) => {
					applyReaction(rkey, emoji, viewer.did, add);
					await source.react({ channel: ref, rkey, emoji, add });
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
					readThrough = messages().at(-1)?.rkey ?? readThrough;
					void source.markRead(ref, behind ? readThrough : undefined);
				},
				clearUnreadMarker: () => setUnreadAfter(undefined),
			};

			typingStops.set(ref, stopTyping);
			channels.set(ref, data);
			const refresh = (): Promise<void> => {
				if (!untrack(ready) || opening) return Promise.resolve();
				opening = true;
				return refreshFromNetwork(
					untrack(viewing) === ref || holds.has(ref),
				).then(
					() => {
						opening = false;
					},
					(thrown: unknown) => {
						opening = false;
						log.warn("channel refresh failed", {
							code: classifyThrown(thrown, {
								method: "channel.listMessages",
							}).code,
						});
					},
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

			feedControls.set(ref, {
				ensureOpen: () => {
					if (!untrack(ready) && !opening) openFeed();
				},
				refresh,
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
					batch(() => {
						setGap(undefined);
						setMessageList([]);
						setCursor(undefined);
						setUnreadAfter(undefined);
						setReady(false);
					});
				},
			});
			openFeed();
			return data;
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
							setLastMessages(event.channel, summarizeMessage(event.message));
						}
					}
					if (event.event === "delete") {
						const rkey = event.rkey ?? event.message?.rkey;
						const current = lastMessages[event.channel];
						if (current && current.rkey === rkey) {
							void loadSummaries(communityOfRef(event.channel), event.channel);
						}
					}
					messageListeners.get(event.channel)?.(event);
					return;
				}
				case "reactionEvent":
					if (event.actor !== viewer.did) {
						messageListeners.get(event.channel)?.(event);
					}
					return;
				case "typingEvent":
					typingListeners.get(event.channel)?.(event.did);
					return;
				case "presenceEvent":
					setPresence(event.did, reconcile(event.presence));
					if (!event.presence.voice) setSpeaking(event.did, false);
					return;
				case "voiceActivityEvent":
					setSpeaking(event.did, event.speaking);
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

		const applyViewer = (next: ProfileView) => {
			const { presence: nextPresence, ...profile } = next;
			setViewer(reconcile({ ...profile, presence: viewer.presence }));
			if (nextPresence) setPresence(next.did, reconcile(nextPresence));
			for (const load of memberLoads.values()) {
				load.update((list) =>
					list.map((member) =>
						member.actor.did === next.did
							? { ...member, actor: { ...member.actor, ...profile } }
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
			const [avatar, banner] = await Promise.all([
				synced ? undefined : uploadImage(draft.avatar, report("avatar")),
				synced ? undefined : uploadImage(draft.banner, report("banner")),
			]);
			const next = await source.putProfile({
				syncBluesky: synced,
				displayName: synced ? undefined : draft.displayName.trim(),
				description: synced ? undefined : draft.description.trim(),
				avatar,
				banner,
				theme: draft.theme,
			});
			applyViewer(next);
		};

		const setStatus = async (input: StatusInput) => {
			const next = await source.setStatus(input);
			setPresence(viewer.did, reconcile(next));
		};

		const setVoice = async (voice: VoiceState | undefined) => {
			const current = presence[viewer.did];
			const previous = current ? { ...current } : undefined;
			const optimistic: Presence = {
				...(previous ?? { onlineState: "online" }),
			};
			if (voice) optimistic.voice = voice;
			else delete optimistic.voice;
			setPresence(viewer.did, reconcile(optimistic));
			try {
				const next = await source.setVoice(voice);
				setPresence(viewer.did, reconcile(next));
			} catch (error) {
				setPresence(
					viewer.did,
					reconcile(previous ?? { onlineState: "online" }),
				);
				throw error;
			}
		};

		const setOnlineState = async (onlineState: Presence["onlineState"]) => {
			const current = presence[viewer.did];
			const previous = current ? { ...current } : undefined;
			setPresence(viewer.did, (current) => ({
				...(current ?? {}),
				onlineState,
			}));
			try {
				const next = await source.setStatus({ onlineState });
				setPresence(viewer.did, reconcile(next));
			} catch (error) {
				if (previous) setPresence(viewer.did, reconcile(previous));
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

		const backfill = createCatchUpQueue();
		onCleanup(backfill.cancel);
		let lastCatchUp = Number.NEGATIVE_INFINITY;
		const catchUp = () => {
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

		const store = {
			access: createAccessStore({ source, memberLoads }),
			emoji: createEmojiStore(
				source,
				() => viewer.did,
				() => communities.value() ?? [],
			),
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
			viewing,
			setViewing,
			holdChannel,
			lastChannel,
			lastSpace: () => lastSpace(),
			bootReady,
			lastMessage: (ref: SpaceRef) => lastMessages[ref],
			setLastChannel,
			isMuted: (ref: SpaceRef) =>
				isThreadSpace(ref)
					? mutedThreads().has(ref)
					: source.preferences.isMuted({ kind: "channel", channel: ref }),
			setMuted: (ref: SpaceRef, muted: boolean) => {
				if (!isThreadSpace(ref)) {
					void source.preferences.setMuted(
						{ kind: "channel", channel: ref },
						muted,
					);
					return;
				}
				setMutedThreads((current) => {
					if (current.has(ref) === muted) return current;
					const next = new Set(current);
					if (muted) next.add(ref);
					else next.delete(ref);
					return next;
				});
			},
			preferences: source.preferences,
			controls: source.preferences.controls,
			source,
			simulation: () => simulation(),
			setSimulation: (next: Partial<Simulation>) => {
				source.setSimulation(next);
				setSimulationSignal(source.simulation());
			},
			setControls: source.preferences.setControls,
			typing: (ref: SpaceRef) => source.typing(ref),
			catchUp,
			pauseCatchUp: backfill.cancel,
			dispose,
		};
		connectVoice(store);
		return store;
	});

export type DataStore = ReturnType<typeof createDataStore>;

export const DataContext = createContext<DataStore>();

export const useData = () => {
	const store = useContext(DataContext);
	if (!store) throw new Error("useData needs a DataContext provider");
	return store;
};
