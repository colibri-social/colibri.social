import {
	type Accessor,
	batch,
	createContext,
	createMemo,
	createRoot,
	createSignal,
	useContext,
} from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { createAccessStore } from "./access-store";
import {
	type ChannelSummary,
	newerSummary,
	summarizeMessage,
} from "./channel-summary";
import { createEmojiStore } from "./emoji-store";
import { channelSlug, isVoiceChannel, skeyOf, spaceKey } from "./ids";
import { createJumpRequests } from "./jump";
import { createNotificationStore } from "./notifications";
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
	type ControlsPreferences,
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
import { connectVoice } from "./voice";

const PAGE_SIZE = 60;
const UNREAD_SEARCH_LIMIT = 400;
const TYPING_MS = 6000;

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
};

type MutableLoad<T> = Load<T> & {
	update: (change: (current: T) => T) => void;
};

export type UnreadState = { hasUnread: boolean; mentions: number };

export type PendingMessage = {
	nonce: string;
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
	hasOlder: Accessor<boolean>;
	loadingOlder: Accessor<boolean>;
	loadOlder: () => void;
	unreadAfter: Accessor<string | undefined>;
	enter: (fresh: boolean) => string | undefined;
	threads: Load<ThreadView[]>;
	typing: Accessor<readonly Did[]>;
	send: (input: {
		text: string;
		facets?: Facet[];
		parent?: string;
		attachments?: AttachmentView[];
		files?: { file: File; previewSrc?: string }[];
	}) => Promise<void>;
	retry: (nonce: string) => Promise<void>;
	discard: (nonce: string) => void;
	edit: (rkey: string, text: string, facets?: Facet[]) => Promise<void>;
	remove: (rkey: string) => Promise<void>;
	react: (rkey: string, emoji: string, add: boolean) => Promise<void>;
	setHidden: (rkey: string, hidden: boolean) => Promise<void>;
	markRead: () => void;
	createThread: (input: CreateThreadDraft) => Promise<ThreadView>;
	detach: (rkeys: readonly string[]) => MessageView[];
	attach: (messages: readonly MessageView[]) => void;
};

export type CreateThreadDraft = {
	name: string;
	anchor?: ThreadAnchor;
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

const createLoad = <T>(fetch: () => Promise<T>): MutableLoad<T> => {
	const [value, setValue] = createSignal<T>();
	const [loading, setLoading] = createSignal(true);
	void fetch().then(
		(result) =>
			batch(() => {
				setValue(() => result);
				setLoading(false);
			}),
		() => setLoading(false),
	);
	const update = (change: (current: T) => T) =>
		setValue((current) => (current === undefined ? current : change(current)));
	return { value, loading, update };
};

const createLazyLoad = <T>(fetch: () => Promise<T>): MutableLoad<T> => {
	let inner: MutableLoad<T> | undefined;
	const ensure = () => {
		inner ??= createRoot(() => createLoad(fetch));
		return inner;
	};
	return {
		value: () => ensure().value(),
		loading: () => ensure().loading(),
		update: (change) => inner?.update(change),
	};
};

let nonceCounter = 0;
const nextNonce = () => `local-${Date.now().toString(36)}-${nonceCounter++}`;

export const createDataStore = (source: DataSource) =>
	createRoot(() => {
		const [viewer, setViewer] = createStore<ProfileView>(source.viewer());
		const memberLoads = new Map<Did, MutableLoad<MemberView[]>>();
		const roleLoads = new Map<Did, MutableLoad<RoleView[]>>();
		const [controls, setControlsSignal] = createSignal(source.controls());
		const [simulation, setSimulationSignal] = createSignal(source.simulation());
		const communities = createLoad(() => source.listCommunities());
		const spaces = new Map<Did, SpaceData>();
		const [lastMessages, setLastMessages] = createStore<
			Record<string, ChannelSummary | undefined>
		>({});
		const putSummary = (summary: ChannelSummary) => {
			if (newerSummary(lastMessages[summary.channel], summary)) {
				setLastMessages(summary.channel, summary);
			}
		};
		const loadSummaries = (community: Did, only?: SpaceRef) =>
			void source.listChannelSummaries(community).then(
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
				() => {},
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
		>({});
		const [viewing, setViewing] = createSignal<SpaceRef>();
		const [lastChannels, setLastChannels] = createStore<Record<string, string>>(
			{},
		);
		const [mutedChannels, setMutedChannels] = createSignal<ReadonlySet<string>>(
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

		const communityOfRef = (ref: SpaceRef) =>
			ref.slice("at://".length, ref.indexOf("/space/")) as Did;

		const space = (community: CommunityView): SpaceData => {
			const existing = spaces.get(community.did);
			if (existing) return existing;
			const categories = createLoad(() => source.listCategories(community.did));
			const channelList = createLoad(() => source.listChannels(community.did));
			loadSummaries(community.did);
			categoryLoads.set(community.did, categories);
			channelLoads.set(community.did, channelList);
			const roles = createLoad(() => source.listRoles(community.did));
			roleLoads.set(community.did, roles);
			const members = createLazyLoad(async () => {
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
			});
			void source.listUnreadStatus(community.did).then((statuses) => {
				const entries: Record<string, UnreadState> = {};
				for (const status of statuses) {
					entries[skeyOf(status.channel)] = {
						hasUnread: status.hasUnread,
						mentions: status.unreadMentions,
					};
				}
				setUnread(community.did, reconcile(entries));
			});

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

			const data: SpaceData = {
				...roleActions,
				community,
				categories,
				channels: channelList,
				roles,
				members,
				memberByDid,
				roleByKey: (rkey) => roles.value()?.find((role) => role.rkey === rkey),
				setMemberRoles,
				kick: removeWith(source.kickMember),
				ban: removeWith(source.banMember),
				channelBySlug: (slug) =>
					channelList.value()?.find((channel) => channelSlug(channel) === slug),
				unread: (slug) =>
					unread[community.did]?.[slug] ?? { hasUnread: false, mentions: 0 },
				totals: () => {
					const entries = Object.values(unread[community.did] ?? {});
					return {
						hasUnread: entries.some((entry) => entry.hasUnread),
						mentions: entries.reduce((sum, entry) => sum + entry.mentions, 0),
					};
				},
			};
			spaces.set(community.did, data);
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

		const withChannel = (community: Did, view: ChannelView, add: boolean) => {
			channelLoads.get(community)?.update((list) => {
				const rest = list.filter((entry) => entry.space !== view.space);
				return add ? [...rest, view] : rest;
			});
			categoryLoads.get(community)?.update((list) =>
				list.map((category) => {
					const rest = category.channels.filter(
						(entry) => entry.space !== view.space,
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
					list.some((entry) => entry.space === view.space)
						? list.map((entry) => (entry.space === view.space ? view : entry))
						: [...list, view],
				);
			categoryLoads.get(community)?.update((list) =>
				list.map((category) => {
					const index = category.channels.findIndex(
						(entry) => entry.space === view.space,
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
			communities.update((list) =>
				list.filter((entry) => entry.did !== community),
			);
			const ids = unseenInCommunity(community);
			if (ids.length) void notifications.markRead(ids).catch(() => {});
		};

		source.subscribe((event) => {
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
					channels.get(view.space)?.markRead();
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

		const channel = (ref: SpaceRef): ChannelData => {
			const existing = channels.get(ref);
			if (existing) return existing;

			const [messages, setMessages] = createSignal<readonly MessageView[]>([]);
			const [pending, setPending] = createSignal<readonly PendingMessage[]>([]);
			const [ready, setReady] = createSignal(false);
			const [cursor, setCursor] = createSignal<string>();
			const [loadingOlder, setLoadingOlder] = createSignal(false);
			const [unreadAfter, setUnreadAfter] = createSignal<string>();
			const [typingSet, setTypingSet] = createSignal<readonly Did[]>([]);
			const typingTimers = new Map<Did, ReturnType<typeof setTimeout>>();
			const community = communityOfRef(ref);
			let readThrough: string | undefined;
			const threads = createLazyLoad(() => source.listThreads(ref));
			threadLoads.set(ref, threads);

			const open = async () => {
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
			};

			const loadOlder = () => {
				const before = cursor();
				if (!before || loadingOlder()) return;
				setLoadingOlder(true);
				void source
					.listMessages({ channel: ref, limit: PAGE_SIZE, cursor: before })
					.then((page) =>
						batch(() => {
							setMessages((list) => [...page.items.slice().reverse(), ...list]);
							setCursor(page.cursor);
							setLoadingOlder(false);
						}),
					);
			};

			const upsert = (message: MessageView) =>
				setMessages((list) => {
					const index = list.findIndex((entry) => entry.rkey === message.rkey);
					if (index === -1) return insertSorted(list, [message]);
					const next = list.slice();
					next[index] = message;
					return next;
				});

			const settlePending = (nonce: string, message: MessageView) =>
				batch(() => {
					setPending((list) => list.filter((entry) => entry.nonce !== nonce));
					upsert(message);
				});

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
							const attachment = await source.uploadBlob(upload.file, {
								onProgress: (progress) =>
									patchUpload(entry.nonce, upload.id, { progress }),
							});
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
				try {
					const message = await source.sendMessage({
						channel: ref,
						text: entry.text,
						facets: entry.facets,
						parent: entry.parent,
						attachments: [...(entry.attachments ?? []), ...uploaded],
					});
					sentNonces.set(message.rkey, entry.nonce);
					const latest = pending().find((item) => item.nonce === entry.nonce);
					settlePending(entry.nonce, message);
					if (latest) revokePreviews(latest);
				} catch {
					markFailed();
				}
			};

			const applyReaction = (
				rkey: string,
				emoji: string,
				actor: Did,
				add: boolean,
			) =>
				setMessages((list) =>
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
					}),
				);

			messageListeners.set(ref, (event) => {
				if (event.$type === "messageEvent") {
					if (event.event === "delete" && event.rkey) {
						const rkey = event.rkey;
						setMessages((list) => list.filter((entry) => entry.rkey !== rkey));
						return;
					}
					if (event.message && ready()) upsert(event.message);
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
				hasOlder: () => !!cursor(),
				loadingOlder,
				loadOlder,
				unreadAfter,
				enter: (fresh) => {
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
					const removed = messages().filter((entry) => keys.has(entry.rkey));
					if (removed.length > 0) {
						setMessages((list) =>
							list.filter((entry) => !keys.has(entry.rkey)),
						);
					}
					return removed;
				},
				attach: (incoming) => {
					if (!ready() || incoming.length === 0) return;
					setMessages((list) => {
						const keys = new Set(incoming.map((entry) => entry.rkey));
						return insertSorted(
							list.filter((entry) => !keys.has(entry.rkey)),
							incoming,
						);
					});
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
						channel: ref,
						text: input.text,
						facets: input.facets,
						parent: input.parent,
						attachments: input.attachments,
						uploads: input.files?.map((file, index) => ({
							id: `${index}`,
							file: file.file,
							previewSrc: file.previewSrc,
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
				react: async (rkey, emoji, add) => {
					applyReaction(rkey, emoji, viewer.did, add);
					await source.react({ channel: ref, rkey, emoji, add });
				},
				markRead: () => {
					const current = unread[community]?.[skeyOf(ref)];
					if (current?.hasUnread) {
						setUnread(community, skeyOf(ref), {
							...current,
							hasUnread: false,
						});
					}
					if (!ready()) return;
					readThrough = messages().at(-1)?.rkey ?? readThrough;
					void source.markRead(ref);
				},
			};

			typingStops.set(ref, stopTyping);
			channels.set(ref, data);
			void open();
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
							loadSummaries(communityOfRef(event.channel), event.channel);
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
				case "seenEvent":
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
			jumps,
			threads: threadActions,
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
			setViewing,
			lastChannel: (space: string) => lastChannels[space],
			lastMessage: (ref: SpaceRef) => lastMessages[ref],
			setLastChannel: (space: string, channel: string) =>
				setLastChannels(space, channel),
			isMuted: (ref: SpaceRef) => mutedChannels().has(ref),
			setMuted: (ref: SpaceRef, muted: boolean) =>
				setMutedChannels((current) => {
					const next = new Set(current);
					if (muted) next.add(ref);
					else next.delete(ref);
					return next;
				}),
			controls,
			source,
			simulation: () => simulation(),
			setSimulation: (next: Partial<Simulation>) => {
				source.setSimulation(next);
				setSimulationSignal(source.simulation());
			},
			setControls: (next: Partial<ControlsPreferences>) => {
				source.setControls(next);
				setControlsSignal(source.controls());
			},
			typing: (ref: SpaceRef) => source.typing(ref),
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
