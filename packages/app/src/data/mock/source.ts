import { summarizeMessage } from "../channel-summary";
import {
	type ControlsPreferences,
	type DataSource,
	type ListMessagesParams,
	type LiveEvent,
	MAX_MOVE_SUBJECTS,
	type Page,
	TransferOwnershipError,
} from "../source";
import type {
	AttachmentView,
	CategoryPermissions,
	CategoryView,
	ChannelView,
	CommunityView,
	Did,
	Facet,
	GifView,
	MemberView,
	MessageView,
	NotificationView,
	Presence,
	SpaceRef,
	ThreadView,
	UnreadStatus,
} from "../types";
import { EMBEDS_SUPPRESSED_LABEL } from "../types";
import { createMockAccess } from "./access";
import { findBlueskyPost } from "./bluesky";
import { createBridgeStore } from "./bridges";
import {
	createCommunityRecord,
	DISCOVERABLE,
	discoverableRecord,
} from "./communities";
import { createMockEmoji } from "./emoji";
import { searchGifs } from "./gifs";
import { latencyScale, setLatencyScale, withLatency } from "./latency";
import { startLive } from "./live";
import {
	contextFor,
	deriveNotifications,
	notificationFor,
} from "./notifications";
import { asDatetime, messageUri, tidFor } from "./refs";
import { createRoleOps } from "./roles";
import { createRandom } from "./seed";
import { mockUpload } from "./uploads";
import { seedVoice } from "./voice";
import { createWorld, MANAGING_APP } from "./world";

export { pendingLatency, setLatency } from "./latency";

const DEFAULT_PAGE = 50;

const categoryPermissionsFrom = (
	input: CategoryPermissions,
): CategoryPermissions => {
	const picked: CategoryPermissions = {};
	if (input.ownerOnly !== undefined) picked.ownerOnly = input.ownerOnly;
	if (input.allowedRoles) picked.allowedRoles = [...input.allowedRoles];
	if (input.allowedMembers) picked.allowedMembers = [...input.allowedMembers];
	if (input.visibleToRoles) picked.visibleToRoles = [...input.visibleToRoles];
	if (input.visibleToMembers) {
		picked.visibleToMembers = [...input.visibleToMembers];
	}
	return picked;
};
const MESSAGE_VIEW = "social.colibri.beta.channel.defs#messageView";

export type MockSourceOptions = {
	now?: number;
	live?: boolean;
};

export type MockSource = DataSource & {
	emit: (event: LiveEvent) => void;
	simulateMessage: (input: {
		author: Did;
		channel: SpaceRef;
		text: string;
		facets?: Facet[];
	}) => MessageView;
	world: ReturnType<typeof createWorld>;
};

export const createMockSource = (
	options: MockSourceOptions = {},
): MockSource => {
	const now = options.now ?? Date.now();
	const world = createWorld(now);
	const bridges = createBridgeStore(world, now);
	for (const seed of DISCOVERABLE) {
		world.spaces.push(discoverableRecord(world, seed, now));
	}
	seedVoice(world);
	const listeners = new Set<(event: LiveEvent) => void>();
	const failures = createRandom(0x5e7d);
	const gifFavorites = new Map<string, GifView>();
	let sendCount = 0;
	let stopLive: (() => void) | undefined;
	let controls: ControlsPreferences = {
		showMessagePreviews: true,
		swipeLeftAction: "members",
		doubleTapEnabled: false,
		doubleTapAction: "react",
		doubleTapReactionEmoji: "👍",
		developerMode: false,
		confirmVoiceJoin: false,
	};

	const emit = (event: LiveEvent) => {
		for (const listener of [...listeners]) listener(event);
	};

	const access = createMockAccess({ world, now, emit });
	const emoji = createMockEmoji({ world, now, emit });

	const spaceOf = (community: Did) => {
		const space = world.spaces.find((entry) => entry.did === community);
		if (!space) throw new Error(`Unknown community ${community}`);
		return space;
	};

	const roleOps = createRoleOps({ spaceOf, viewerDid: world.viewerDid, emit });

	const removeMember = (input: { community: Did; subject: Did }) => {
		const space = spaceOf(input.community);
		const index = space.members.findIndex(
			(entry) => entry.actor.did === input.subject,
		);
		if (index < 0) throw new Error(`Unknown member ${input.subject}`);
		space.members.splice(index, 1);
	};

	let notifications: NotificationView[] | undefined;
	const allNotifications = () => {
		notifications ??= deriveNotifications(world, now);
		return notifications;
	};

	const liveEmit = (event: LiveEvent) => {
		emit(event);
		if (event.$type !== "messageEvent" || event.event !== "create") return;
		const message = event.message;
		if (!message) return;
		const space = world.spaces.find((entry) =>
			entry.channels.some((channel) => channel.view.space === event.channel),
		);
		if (!space) return;
		const context = contextFor(world, space.did);
		if (!context) return;
		const view = notificationFor(
			message,
			{ community: space.did, channel: event.channel },
			context,
		);
		if (!view) return;
		allNotifications().unshift(view);
		emit({ $type: "notificationEvent", notification: view });
	};

	const channelRecord = (ref: SpaceRef) => {
		for (const space of world.spaces) {
			const channel = space.channels.find((entry) => entry.view.space === ref);
			if (channel) return channel;
		}
		return undefined;
	};

	const threadRecord = (ref: SpaceRef) => {
		for (const space of world.spaces) {
			const thread = space.threads.find((entry) => entry.view.space === ref);
			if (thread) return thread;
		}
		return undefined;
	};

	const allowedIn = (
		space: (typeof world.spaces)[number],
		permission: string,
	) =>
		!!space.view.viewer.isOwner ||
		!!space.view.viewer.permissions?.includes(permission);

	const communityOf = (ref: SpaceRef) =>
		ref.slice("at://".length, ref.indexOf("/space/")) as Did;

	const manageableThread = (ref: SpaceRef) => {
		for (const space of world.spaces) {
			const record = space.threads.find((entry) => entry.view.space === ref);
			if (!record) continue;
			const own = record.view.createdBy === world.viewerDid;
			if (!own && !allowedIn(space, "thread.manage")) {
				throw new Error("Not allowed to manage this thread");
			}
			return { space, record };
		}
		throw new Error(`Unknown thread ${ref}`);
	};

	const messagesFor = (ref: SpaceRef): MessageView[] => {
		const channel = channelRecord(ref);
		if (channel) return world.messagesOf(channel);
		const thread = threadRecord(ref);
		if (thread) return thread.messages;
		throw new Error(`Unknown channel ${ref}`);
	};

	const findMessage = (ref: SpaceRef, rkey: string) => {
		const list = messagesFor(ref);
		const index = list.findIndex((message) => message.rkey === rkey);
		if (index < 0) throw new Error(`Unknown message ${rkey}`);
		return { list, index, message: list[index] as MessageView };
	};

	const touchThread = (ref: SpaceRef) => {
		const thread = threadRecord(ref);
		if (!thread) return;
		const last = thread.messages[thread.messages.length - 1];
		thread.view = {
			...thread.view,
			messageCount: thread.messages.length,
			lastActivityAt: last?.createdAt ?? thread.view.lastActivityAt,
		} as ThreadView;
	};

	const append = (message: MessageView) => {
		messagesFor(message.channel).push(message);
		touchThread(message.channel);
		const thread = threadRecord(message.channel);
		if (thread) {
			emit({ $type: "threadEvent", event: "update", thread: thread.view });
		}
	};

	const createMessage = (input: {
		author: Did;
		channel: SpaceRef;
		rkey?: string;
		text: string;
		facets?: Facet[];
		parent?: string;
		attachments?: AttachmentView[];
		forward?: MessageView["forward"];
	}): MessageView => {
		const time = Math.max(
			Date.now(),
			Date.parse(messagesFor(input.channel).at(-1)?.createdAt ?? "0") + 1,
		);
		const rkey = input.rkey ?? tidFor(time, world.nextClock());
		const view: MessageView = {
			uri: messageUri(input.author, rkey),
			rkey,
			channel: input.channel,
			author: world.people.profile(input.author),
			text: input.text,
			createdAt: asDatetime(time),
			attachments: input.attachments ?? [],
			reactions: [],
			labels: [],
		};
		if (input.forward) view.forward = input.forward;
		if (input.facets?.length) view.facets = input.facets;
		if (input.parent) {
			const parent = messagesFor(input.channel).find(
				(message) => message.rkey === input.parent,
			);
			if (parent) {
				const { parent: _nested, ...rest } = parent;
				view.parent = { ...rest, $type: MESSAGE_VIEW } as never;
			}
		}
		return view;
	};

	const applyReaction = (
		ref: SpaceRef,
		rkey: string,
		emoji: string,
		actor: Did,
		add: boolean,
	) => {
		const { list, index, message } = findMessage(ref, rkey);
		const reactions = message.reactions.map((reaction) => ({ ...reaction }));
		const existing = reactions.find((reaction) => reaction.emoji === emoji);
		const isViewer = actor === world.viewerDid;
		if (add) {
			if (existing) {
				if (existing.reactors.includes(actor)) return false;
				existing.reactors = [...existing.reactors, actor];
				existing.count += 1;
				if (isViewer) existing.viewerReacted = true;
			} else {
				reactions.push({
					emoji,
					count: 1,
					reactors: [actor],
					...(isViewer ? { viewerReacted: true } : {}),
				});
			}
		} else {
			if (!existing?.reactors.includes(actor)) return false;
			existing.reactors = existing.reactors.filter((did) => did !== actor);
			existing.count -= 1;
			if (isViewer) delete existing.viewerReacted;
		}
		list[index] = {
			...message,
			reactions: reactions.filter((reaction) => reaction.count > 0),
		};
		return true;
	};

	const page = (params: ListMessagesParams): Page<MessageView> => {
		const list = messagesFor(params.channel);
		const limit = Math.max(1, Math.min(100, params.limit ?? DEFAULT_PAGE));
		if (params.reverse) {
			const start = params.cursor
				? list.findIndex((message) => message.rkey > (params.cursor as string))
				: 0;
			if (start < 0) return { items: [] };
			const items = list.slice(start, start + limit);
			const more = start + limit < list.length;
			return more ? { items, cursor: items.at(-1)?.rkey } : { items };
		}
		let end = list.length;
		if (params.cursor) {
			end = list.findIndex(
				(message) => message.rkey >= (params.cursor as string),
			);
			if (end < 0) end = list.length;
		}
		const start = Math.max(0, end - limit);
		const items = list.slice(start, end).reverse();
		return start > 0 ? { items, cursor: items.at(-1)?.rkey } : { items };
	};

	const unseenMentions = (channel: SpaceRef) =>
		allNotifications().filter(
			(view) =>
				!view.seenAt &&
				!view.thread &&
				!!view.message &&
				view.channel === channel,
		).length;

	const unreadFor = (community: Did): UnreadStatus[] => {
		const space = spaceOf(community);
		return space.channels
			.filter(
				(channel) => channel.view.type === "social.colibri.beta.channel.text",
			)
			.map((channel) => {
				const list = world.messagesOf(channel);
				const cursor = channel.readCursor;
				const after = cursor
					? list.filter((message) => message.rkey > cursor)
					: list;
				const unread = after.filter(
					(message) => message.author.did !== world.viewerDid,
				);
				const status: UnreadStatus = {
					channel: channel.view.space,
					hasUnread: unread.length > 0,
					unreadMentions: unseenMentions(channel.view.space),
				};
				if (cursor) status.cursor = cursor;
				return status;
			});
	};

	const source: MockSource = {
		...access,
		...emoji,
		world,
		emit,
		simulateMessage: (input) => {
			const message = createMessage(input);
			append(message);
			liveEmit({
				$type: "messageEvent",
				event: "create",
				channel: input.channel,
				message,
			});
			return message;
		},
		viewer: () => world.people.profile(world.viewerDid),
		updateCommunity: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "community.manage")) {
					throw new Error("Not allowed to manage this Space");
				}
				if (input.name !== undefined && /\bfail\b/i.test(input.name)) {
					throw new Error("Space could not be updated");
				}
				const { community: _community, ...changes } = input;
				const next: CommunityView = { ...space.view };
				for (const [key, value] of Object.entries(changes)) {
					if (value !== undefined) Object.assign(next, { [key]: value });
				}
				space.view = next;
				emit({ $type: "communityEvent", event: "update", community: next });
				return next;
			}),
		putCommunityImage: async (input) => {
			const space = spaceOf(input.community);
			if (!allowedIn(space, "community.manage")) {
				throw new Error("Not allowed to manage this Space");
			}
			const blob = await mockUpload(input.file, {
				onProgress: input.onProgress,
			});
			const next: CommunityView = {
				...space.view,
				[input.kind]: blob.url,
			};
			space.view = next;
			emit({ $type: "communityEvent", event: "update", community: next });
			return next;
		},
		deleteCommunityImage: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "community.manage")) {
					throw new Error("Not allowed to manage this Space");
				}
				const next: CommunityView = { ...space.view };
				delete next[input.kind];
				space.view = next;
				emit({ $type: "communityEvent", event: "update", community: next });
				return next;
			}),
		deleteCommunity: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "community.delete")) {
					throw new Error("Not allowed to delete this Space");
				}
				world.spaces.splice(world.spaces.indexOf(space), 1);
				emit({
					$type: "communityEvent",
					event: "delete",
					community: space.view,
				});
			}),
		leaveCommunity: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (space.view.viewer.isOwner) {
					throw new Error("SoleOwner");
				}
				world.spaces.splice(world.spaces.indexOf(space), 1);
				emit({
					$type: "communityEvent",
					event: "delete",
					community: space.view,
				});
			}),
		transferOwnership: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				const held = space.view.viewer.roles ?? [];
				const ownerRoles = space.roles
					.filter((role) => role.protected && held.includes(role.rkey))
					.map((role) => role.rkey);
				if (!space.view.viewer.isOwner || ownerRoles.length === 0) {
					throw new TransferOwnershipError("Forbidden");
				}
				const target = space.members.find(
					(entry) => entry.actor.did === input.subject,
				);
				if (!target) throw new TransferOwnershipError("MemberNotFound");
				const protectedRoles = new Set(
					space.roles.filter((role) => role.protected).map((role) => role.rkey),
				);
				if ((target.roles ?? []).some((rkey) => protectedRoles.has(rkey))) {
					throw new TransferOwnershipError("AlreadyOwner");
				}
				const viewerMember = space.members.find(
					(entry) => entry.actor.did === world.viewerDid,
				);
				const viewerRoles = held.filter((rkey) => !ownerRoles.includes(rkey));
				target.roles = [...new Set([...(target.roles ?? []), ...ownerRoles])];
				if (viewerMember) viewerMember.roles = viewerRoles;
				space.view = {
					...space.view,
					viewer: {
						...space.view.viewer,
						isOwner: false,
						roles: viewerRoles,
						permissions: [
							...new Set(
								space.roles
									.filter((role) => viewerRoles.includes(role.rkey))
									.flatMap((role) => role.permissions),
							),
						],
					},
				};
				for (const member of [target, viewerMember]) {
					if (!member) continue;
					emit({
						$type: "memberRolesEvent",
						community: space.did,
						subject: member.actor.did,
						roles: [...(member.roles ?? [])],
					});
				}
				emit({
					$type: "communityEvent",
					event: "update",
					community: space.view,
				});
				const served = (member: MemberView) => ({
					...member,
					actor: world.people.profile(member.actor.did),
					roles: [...(member.roles ?? [])],
				});
				return {
					owner: served(target),
					previousOwner: viewerMember
						? served(viewerMember)
						: {
								actor: world.people.profile(world.viewerDid),
								roles: viewerRoles,
								joinedAt: asDatetime(Date.now()),
							},
				};
			}),
		createCommunity: (input) =>
			withLatency(() => {
				const name = input.name.trim();
				if (!name || name.length > 32) {
					throw new Error("Space names are 1 to 32 characters long.");
				}
				if (/\bfail\b/i.test(name)) {
					throw new Error("Colibri couldn't create the Space.");
				}
				const record = createCommunityRecord(world, { ...input, name }, now);
				world.spaces.push(record);
				emit({
					$type: "communityEvent",
					event: "create",
					community: record.view,
				});
				return record.view;
			}),
		getCommunity: (community) => withLatency(() => spaceOf(community).view),
		listDiscoverable: () =>
			withLatency(() =>
				world.spaces
					.filter((space) => !space.seed.key.startsWith("created-"))
					.map((space) => space.view),
			),
		listBridges: (community) =>
			withLatency(() => {
				spaceOf(community);
				return bridges.list(community);
			}),
		listBridgeRooms: (input) =>
			withLatency(() => bridges.rooms(input.community, input.registration)),
		getBridgePairing: (code) => withLatency(() => bridges.pairing(code)),
		redeemBridgePairing: (input) =>
			withLatency(() => {
				if (!allowedIn(spaceOf(input.community), "community.manage")) {
					throw new Error("Forbidden");
				}
				return bridges.redeem(input.community, input.code);
			}),
		updateBridge: (input) =>
			withLatency(() => {
				if (!allowedIn(spaceOf(input.community), "community.manage")) {
					throw new Error("Forbidden");
				}
				return bridges.update(input);
			}),
		revokeBridge: (input) =>
			withLatency(() => {
				if (!allowedIn(spaceOf(input.community), "community.manage")) {
					throw new Error("Forbidden");
				}
				bridges.revoke(input.community, input.registration);
			}),
		listCommunities: () =>
			withLatency(() =>
				world.spaces
					.filter((space) => space.view.viewer.isMember)
					.map((space) => space.view),
			),
		listCategories: (community) =>
			withLatency(() => world.categoriesOf(spaceOf(community))),
		listChannels: (community) =>
			withLatency(() => world.channelsOf(spaceOf(community))),
		listChannelSummaries: (community) =>
			withLatency(() =>
				spaceOf(community).channels.flatMap((record) => {
					const last = world.messagesOf(record).at(-1);
					return last ? [summarizeMessage(last)] : [];
				}),
			),
		listRoles: (community) => withLatency(() => [...spaceOf(community).roles]),
		listMembers: (community, paging = {}) =>
			withLatency(() => {
				const members = spaceOf(community).members.map((member) => ({
					...member,
					actor: world.people.profile(member.actor.did),
				}));
				const start = paging.cursor ? Number(paging.cursor) : 0;
				const limit = Math.max(1, Math.min(100, paging.limit ?? 100));
				const items = members.slice(start, start + limit);
				const next = start + limit;
				return next < members.length
					? { items, cursor: String(next) }
					: { items };
			}),
		...roleOps,
		kickMember: (input) => withLatency(() => removeMember(input)),
		banMember: (input) =>
			withLatency(() => {
				removeMember(input);
				access.recordBan(input);
			}),
		listMessages: (params) => withLatency(() => page(params)),
		listThreads: (channel) =>
			withLatency(() =>
				world.spaces
					.flatMap((space) => space.threads)
					.filter((thread) => thread.view.channel === channel)
					.map((thread) => ({ ...thread.view })),
			),
		moveMessages: (input) =>
			withLatency(() => {
				const count = input.subjects.length;
				if (count === 0 || count > MAX_MOVE_SUBJECTS) {
					throw new Error("Select between 1 and 50 messages");
				}
				if (input.source === input.destination) {
					throw new Error("The messages are already there");
				}
				const community = communityOf(input.source);
				if (communityOf(input.destination) !== community) {
					throw new Error("Messages can only move within a Space");
				}
				const space = spaceOf(community);
				if (!allowedIn(space, "thread.move")) {
					throw new Error("Not allowed to move messages");
				}
				const from = messagesFor(input.source);
				const to = messagesFor(input.destination);
				const indexes = input.subjects.map((subject) => {
					const index = from.findIndex(
						(message) =>
							message.rkey === subject.rkey &&
							message.author.did === subject.did,
					);
					if (index < 0) throw new Error(`Unknown message ${subject.rkey}`);
					return index;
				});
				const moved = indexes
					.sort((a, b) => b - a)
					.map((index) => from.splice(index, 1)[0] as MessageView)
					.reverse();
				for (const message of moved) {
					const at = to.findIndex((entry) => entry.rkey > message.rkey);
					if (at < 0) to.push(message);
					else to.splice(at, 0, message);
				}
				const rkeys = new Set(moved.map((message) => message.rkey));
				if (channelRecord(input.destination)) {
					for (const record of space.threads) {
						const anchor = record.view.anchor;
						if (anchor?.space !== input.source || !rkeys.has(anchor.rkey)) {
							continue;
						}
						record.view = {
							...record.view,
							channel: input.destination,
							anchor: { ...anchor, space: input.destination },
						} as ThreadView;
						emit({
							$type: "threadEvent",
							event: "update",
							thread: record.view,
						});
					}
				}
				for (const ref of [input.source, input.destination]) {
					const record = threadRecord(ref);
					if (!record) continue;
					touchThread(ref);
					emit({ $type: "threadEvent", event: "update", thread: record.view });
				}
				for (const message of moved) {
					emit({
						$type: "messageEvent",
						event: "delete",
						channel: input.source,
						rkey: message.rkey,
					});
					emit({
						$type: "messageEvent",
						event: "update",
						channel: input.destination,
						message,
					});
				}
				return { batch: tidFor(Date.now(), world.nextClock()), count };
			}),
		repoint: (input) =>
			withLatency(() => {
				const record = threadRecord(input.thread);
				if (!record) throw new Error(`Unknown thread ${input.thread}`);
				const space = spaceOf(record.view.community);
				if (!allowedIn(space, "thread.move")) {
					throw new Error("Not allowed to move threads");
				}
				const channel = channelRecord(input.channel);
				if (!channel || communityOf(input.channel) !== space.did) {
					throw new Error(`Unknown channel ${input.channel}`);
				}
				const view = { ...record.view, channel: input.channel } as ThreadView;
				if (input.anchor) {
					if (input.anchor.space !== input.channel) {
						throw new Error("The anchor has to sit in the new channel");
					}
					const anchor = world
						.messagesOf(channel)
						.find((message) => message.rkey === input.anchor?.rkey);
					view.anchor = input.anchor;
					if (anchor) {
						const { parent: _parent, ...rest } = anchor;
						view.anchorMessage = { ...rest, $type: MESSAGE_VIEW } as never;
					}
				}
				record.view = view;
				emit({ $type: "threadEvent", event: "update", thread: view });
				return view;
			}),
		createThread: (input) =>
			withLatency(() => {
				if (/\bfail\b/i.test(input.name)) {
					throw new Error("Thread could not be created");
				}
				const space = spaceOf(input.community);
				const viewer = space.view.viewer;
				if (!viewer.isOwner && !viewer.permissions?.includes("thread.create")) {
					throw new Error("Not allowed to create threads");
				}
				const channel = channelRecord(input.channel);
				if (!channel) throw new Error(`Unknown channel ${input.channel}`);
				const time = Date.now();
				const tkey = tidFor(time, world.nextClock());
				const threadRef =
					`at://${space.did}/space/social.colibri.beta.channel.thread/${tkey}` as SpaceRef;
				const view: ThreadView = {
					space: threadRef,
					channel: input.channel,
					community: space.did,
					name: input.name,
					createdBy: world.viewerDid,
					createdAt: asDatetime(time),
					lastActivityAt: asDatetime(time),
					messageCount: 0,
					participants: [world.viewerDid],
					viewer: {
						canRead: true,
						canPost: true,
						canManage: true,
						following: true,
						muted: false,
					},
				} as ThreadView;
				if (input.anchor) {
					const anchor = world
						.messagesOf(channel)
						.find((message) => message.rkey === input.anchor?.rkey);
					if (anchor) {
						const { parent: _parent, ...rest } = anchor;
						view.anchor = input.anchor;
						view.anchorMessage = { ...rest, $type: MESSAGE_VIEW } as never;
						if (!view.participants.includes(anchor.author.did)) {
							view.participants = [...view.participants, anchor.author.did];
						}
					}
				}
				space.threads.push({ view, messages: [] });
				emit({ $type: "threadEvent", event: "create", thread: view });
				return view;
			}),
		updateThread: (input) =>
			withLatency(() => {
				const { record } = manageableThread(input.thread);
				if (input.name !== undefined) {
					const name = input.name.trim();
					if (!name || name.length > 128) throw new Error("Invalid name");
					if (/\bfail\b/i.test(name)) throw new Error("Rename failed");
				}
				const view: ThreadView = { ...record.view };
				if (input.name !== undefined) view.name = input.name.trim();
				record.view = view;
				emit({ $type: "threadEvent", event: "update", thread: view });
				return view;
			}),
		deleteThread: (input) =>
			withLatency(() => {
				const { space, record } = manageableThread(input.thread);
				space.threads.splice(space.threads.indexOf(record), 1);
				emit({ $type: "threadEvent", event: "delete", thread: record.view });
			}),
		followThread: (input) =>
			withLatency(() => {
				const record = threadRecord(input.thread);
				if (!record) throw new Error(`Unknown thread ${input.thread}`);
				const view: ThreadView = {
					...record.view,
					viewer: { ...record.view.viewer, following: input.follow },
				};
				record.view = view;
				emit({ $type: "threadEvent", event: "update", thread: view });
			}),
		createChannel: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "channel.create")) {
					throw new Error("Not allowed to create channels");
				}
				const name = input.name.trim();
				if (!name || name.length > 32) throw new Error("Invalid name");
				const skey = tidFor(Date.now(), world.nextClock());
				const ref = `at://${space.did}/space/${input.type}/${skey}` as SpaceRef;
				const view: ChannelView = {
					space: ref,
					type: input.type as ChannelView["type"],
					name,
					viewer: {
						canRead: true,
						canPost: true,
						permissions: space.view.viewer.permissions ?? [],
					},
				} as ChannelView;
				if (input.category) view.category = input.category;
				if (input.description) view.description = input.description;
				if (input.private) view.private = true;
				if (input.ownerOnly) view.ownerOnly = true;
				if (input.allowedRoles?.length) view.allowedRoles = input.allowedRoles;
				if (input.allowedMembers?.length) {
					view.allowedMembers = input.allowedMembers;
				}
				if (input.visibleToRoles?.length) {
					view.visibleToRoles = input.visibleToRoles;
					view.private = true;
				}
				if (input.visibleToMembers?.length) {
					view.visibleToMembers = input.visibleToMembers;
					view.private = true;
				}
				space.channels.push({
					view,
					spaceKey: space.seed.key,
					messages: [],
					build: () => [],
				});
				const served = world.channelViewIn(space, view);
				emit({
					$type: "channelEvent",
					event: "create",
					community: space.did,
					channel: served,
				});
				return served;
			}),
		deleteChannel: (input) =>
			withLatency(() => {
				const record = channelRecord(input.channel);
				const space = world.spaces.find((entry) =>
					entry.channels.some((channel) => channel === record),
				);
				if (!record || !space)
					throw new Error(`Unknown channel ${input.channel}`);
				if (!allowedIn(space, "channel.delete")) {
					throw new Error("Not allowed to delete channels");
				}
				space.channels.splice(space.channels.indexOf(record), 1);
				space.threads = space.threads.filter(
					(thread) => thread.view.channel !== input.channel,
				);
				emit({
					$type: "channelEvent",
					event: "delete",
					community: space.did,
					channel: record.view,
				});
			}),
		updateChannel: (input) =>
			withLatency(() => {
				const record = channelRecord(input.channel);
				const space = world.spaces.find((entry) =>
					entry.channels.some((channel) => channel === record),
				);
				if (!record || !space)
					throw new Error(`Unknown channel ${input.channel}`);
				if (!allowedIn(space, "channel.update")) {
					throw new Error("Not allowed to update channels");
				}
				const view: ChannelView = { ...record.view };
				if (input.name !== undefined) {
					const name = input.name.trim();
					if (!name || name.length > 32 || /\bfail\b/i.test(name)) {
						throw new Error("Invalid name");
					}
					view.name = name;
				}
				if (input.description !== undefined) {
					if (input.description.length > 256) {
						throw new Error("Invalid description");
					}
					if (input.description) view.description = input.description;
					else delete view.description;
				}
				if (input.category !== undefined) {
					if (!space.categories.some((entry) => entry.rkey === input.category))
						throw new Error("Unknown category");
					view.category = input.category;
				}
				if (input.ownerOnly !== undefined) view.ownerOnly = input.ownerOnly;
				if (input.linkEmbeds !== undefined) view.linkEmbeds = input.linkEmbeds;
				if (input.allowedRoles !== undefined) {
					view.allowedRoles = input.allowedRoles;
				}
				if (input.allowedMembers !== undefined) {
					view.allowedMembers = input.allowedMembers;
				}
				if (input.visibleToRoles !== undefined) {
					view.visibleToRoles = input.visibleToRoles;
				}
				if (input.visibleToMembers !== undefined) {
					view.visibleToMembers = input.visibleToMembers;
				}
				view.private =
					!!view.visibleToRoles?.length || !!view.visibleToMembers?.length;
				record.view = view;
				const served = world.channelViewIn(space, view);
				emit({
					$type: "channelEvent",
					event: "update",
					community: space.did,
					channel: served,
				});
				return served;
			}),
		createCategory: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "category.create")) {
					throw new Error("Not allowed to create categories");
				}
				const name = input.name.trim();
				if (!name || name.length > 32 || /\bfail\b/i.test(name)) {
					throw new Error("Invalid name");
				}
				const rkey = tidFor(Date.now(), world.nextClock());
				space.categories.push({
					rkey,
					name,
					...categoryPermissionsFrom(input),
				});
				const view = world
					.categoriesOf(space)
					.find((entry) => entry.rkey === rkey) as CategoryView;
				emit({
					$type: "categoryEvent",
					event: "create",
					community: space.did,
					category: view,
				});
				return view;
			}),
		updateCategory: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "category.update")) {
					throw new Error("Not allowed to update categories");
				}
				const index = space.categories.findIndex(
					(entry) => entry.rkey === input.category,
				);
				const existing = space.categories[index];
				if (!existing) throw new Error("Unknown category");
				const name = (input.name ?? existing.name).trim();
				if (!name || name.length > 32 || /\bfail\b/i.test(name)) {
					throw new Error("Invalid name");
				}
				space.categories[index] = {
					...existing,
					name,
					...categoryPermissionsFrom(input),
				};
				const view = world
					.categoriesOf(space)
					.find((entry) => entry.rkey === input.category) as CategoryView;
				emit({
					$type: "categoryEvent",
					event: "update",
					community: space.did,
					category: view,
				});
				for (const channel of view.channels) {
					emit({
						$type: "channelEvent",
						event: "update",
						community: space.did,
						channel,
					});
				}
				return view;
			}),
		deleteCategory: (input) =>
			withLatency(() => {
				const space = spaceOf(input.community);
				if (!allowedIn(space, "category.delete")) {
					throw new Error("Not allowed to delete categories");
				}
				const view = world
					.categoriesOf(space)
					.find((entry) => entry.rkey === input.category);
				if (!view) throw new Error("Unknown category");
				space.categories = space.categories.filter(
					(entry) => entry.rkey !== input.category,
				);
				for (const record of space.channels) {
					if (record.view.category !== input.category) continue;
					const next: ChannelView = { ...record.view };
					delete next.category;
					record.view = next;
					emit({
						$type: "channelEvent",
						event: "update",
						community: space.did,
						channel: next,
					});
				}
				emit({
					$type: "categoryEvent",
					event: "delete",
					community: space.did,
					category: { ...view, channels: [] },
				});
			}),
		listUnreadStatus: (community) => withLatency(() => unreadFor(community)),
		sendMessage: (input) => {
			sendCount += 1;
			const forced = /\bfail\b/i.test(input.text);
			const fails = forced || (sendCount > 1 && failures.chance(1 / 15));
			return withLatency(() => {
				if (fails) throw new Error("Message could not be sent");
				const view = createMessage({ ...input, author: world.viewerDid });
				append(view);
				const channel = channelRecord(input.channel);
				if (channel) channel.readCursor = view.rkey;
				emit({
					$type: "messageEvent",
					event: "create",
					channel: input.channel,
					message: view,
				});
				return view;
			});
		},
		editMessage: (input) =>
			withLatency(() => {
				const { list, index, message } = findMessage(input.channel, input.rkey);
				const next: MessageView = {
					...message,
					text: input.text,
					updatedAt: asDatetime(Date.now()),
				};
				if (input.facets?.length) next.facets = input.facets;
				else delete next.facets;
				list[index] = next;
				emit({
					$type: "messageEvent",
					event: "update",
					channel: input.channel,
					message: next,
				});
				return next;
			}),
		deleteMessage: (input) =>
			withLatency(() => {
				const { list, index } = findMessage(input.channel, input.rkey);
				list.splice(index, 1);
				touchThread(input.channel);
				emit({
					$type: "messageEvent",
					event: "delete",
					channel: input.channel,
					rkey: input.rkey,
				});
			}),
		react: (input) =>
			withLatency(() => {
				const changed = applyReaction(
					input.channel,
					input.rkey,
					input.emoji,
					world.viewerDid,
					input.add,
				);
				if (!changed) return;
				emit({
					$type: "reactionEvent",
					event: input.add ? "create" : "delete",
					channel: input.channel,
					target: input.rkey,
					emoji: input.emoji,
					actor: world.viewerDid,
				});
			}),
		uploadBlob: (file, options) => mockUpload(file, options),
		putProfile: (input) =>
			withLatency(() => {
				const did = world.viewerDid;
				if (input.syncBluesky) {
					world.people.setProfile(
						did,
						{ syncBluesky: true, theme: input.theme ?? null },
						true,
					);
				} else {
					world.people.setProfile(did, {
						syncBluesky: false,
						displayName: input.displayName,
						description: input.description || null,
						avatar:
							input.avatar === undefined
								? undefined
								: (input.avatar?.url ?? null),
						banner:
							input.banner === undefined
								? undefined
								: (input.banner?.url ?? null),
						theme: input.theme ?? null,
					});
				}
				return world.people.profile(did);
			}),
		setVoice: (voice) =>
			withLatency(() => {
				const did = world.viewerDid;
				const current = world.people.presenceOf(did) ?? {
					onlineState: "online" as const,
				};
				const next: Presence = { ...current };
				if (voice) next.voice = voice;
				else delete next.voice;
				world.people.setPresence(did, next);
				emit({ $type: "presenceEvent", did, presence: next });
				return next;
			}),
		setStatus: (input) =>
			withLatency(() => {
				const did = world.viewerDid;
				const current = world.people.presenceOf(did) ?? {
					onlineState: "online" as const,
				};
				const status = { ...current.status, text: current.status?.text ?? "" };
				if (input.text !== undefined) status.text = input.text;
				if (input.emoji !== undefined) {
					if (input.emoji) status.emoji = input.emoji;
					else delete status.emoji;
				}
				if (input.expiresAt) status.expiresAt = input.expiresAt;
				else if (input.removeExpiresAt) delete status.expiresAt;
				if (input.showWhileOffline !== undefined) {
					if (input.showWhileOffline) status.showWhileOffline = true;
					else delete status.showWhileOffline;
				}
				const next: Presence = {
					onlineState: input.onlineState ?? current.onlineState,
				};
				if (current.voice) next.voice = current.voice;
				if (status.text || status.emoji) next.status = status;
				world.people.setPresence(did, next);
				emit({ $type: "presenceEvent", did, presence: next });
				return next;
			}),
		listGifs: (query) => withLatency(() => searchGifs(query)),
		gifFavorites: () => [...gifFavorites.values()],
		setGifFavorite: (gif, favorite) => {
			if (favorite) gifFavorites.set(gif.id, gif);
			else gifFavorites.delete(gif.id);
		},
		forwardMessage: (input) =>
			withLatency(() => {
				const { message } = findMessage(input.from, input.rkey);
				const source = channelRecord(input.from);
				const view = createMessage({
					author: world.viewerDid,
					channel: input.to,
					text: input.text ?? "",
					forward: {
						source: {
							space: input.from,
							did: message.author.did,
							rkey: message.rkey,
						},
						sourceName: source?.view.name,
						sourceCommunity: input.from.slice(
							"at://".length,
							input.from.indexOf("/space/"),
						) as Did,
						createdAt: message.createdAt,
						text: message.text,
						facets: message.facets,
						attachments: message.attachments,
					},
				});
				append(view);
				emit({
					$type: "messageEvent",
					event: "create",
					channel: input.to,
					message: view,
				});
				return view;
			}),
		simulation: () => ({ slowNetwork: latencyScale() > 1 }),
		setSimulation: (next) => {
			if (next.slowNetwork !== undefined) {
				setLatencyScale(next.slowNetwork ? 5 : 1);
			}
		},
		setHidden: (input) =>
			withLatency(() => {
				const { list, index, message } = findMessage(input.channel, input.rkey);
				const others = message.labels.filter((label) => label.val !== "hidden");
				const next: MessageView = {
					...message,
					labels: input.hidden
						? [
								...others,
								{
									src: MANAGING_APP,
									val: "hidden",
									createdAt: asDatetime(Date.now()),
								} as MessageView["labels"][number],
							]
						: others,
				};
				list[index] = next;
				emit({
					$type: "messageEvent",
					event: "update",
					channel: input.channel,
					message: next,
				});
				return next;
			}),
		setSuppressedEmbeds: (input) =>
			withLatency(() => {
				const { list, index, message } = findMessage(input.channel, input.rkey);
				const next: MessageView = { ...message };
				if (input.uris.length > 0) {
					next.suppressedEmbeds = [
						...new Set(input.uris),
					] as MessageView["suppressedEmbeds"];
				} else {
					delete next.suppressedEmbeds;
				}
				list[index] = next;
				emit({
					$type: "messageEvent",
					event: "update",
					channel: input.channel,
					message: next,
				});
				return next;
			}),
		setModeratedEmbeds: (input) =>
			withLatency(() => {
				const { list, index, message } = findMessage(input.channel, input.rkey);
				const others = message.labels.filter(
					(label) => label.val !== EMBEDS_SUPPRESSED_LABEL,
				);
				const next: MessageView = {
					...message,
					labels:
						input.uris.length > 0
							? [
									...others,
									{
										src: MANAGING_APP,
										val: EMBEDS_SUPPRESSED_LABEL,
										scope: [...new Set(input.uris)],
										createdAt: asDatetime(Date.now()),
									} as MessageView["labels"][number],
								]
							: others,
				};
				list[index] = next;
				emit({
					$type: "messageEvent",
					event: "update",
					channel: input.channel,
					message: next,
				});
				return next;
			}),
		getBlueskyPost: (url) => withLatency(() => findBlueskyPost(url, now)),
		markRead: (channel, through) =>
			withLatency(() => {
				const record = channelRecord(channel);
				const thread = threadRecord(channel);
				if (record)
					record.readCursor = through ?? world.messagesOf(record).at(-1)?.rkey;
				if (thread)
					thread.view = {
						...thread.view,
						viewer: {
							...thread.view.viewer,
							hasUnread: false,
							unreadMentions: 0,
						},
					};
				emit({
					$type: "seenEvent",
					channel,
					unread: 0,
					seenAt: asDatetime(Date.now()),
				});
			}),
		typing: () => {},
		listNotifications: (params = {}) =>
			withLatency(() => {
				const list = allNotifications();
				const start = params.cursor ? Number(params.cursor) : 0;
				const limit = Math.max(1, Math.min(100, params.limit ?? 50));
				const items = list.slice(start, start + limit);
				const next = start + limit;
				return next < list.length ? { items, cursor: String(next) } : { items };
			}),
		updateSeen: (input) =>
			withLatency(() => {
				const cutoff = Date.parse(input.seenAt);
				for (const view of allNotifications()) {
					if (!view.seenAt && Date.parse(view.indexedAt) <= cutoff) {
						view.seenAt = input.seenAt;
					}
				}
			}),
		updateSeenForMessage: (input) =>
			withLatency(() => {
				const seenAt = asDatetime(Date.now());
				for (const view of allNotifications()) {
					if (
						!view.seenAt &&
						view.message?.author.did === input.message.did &&
						view.message.rkey === input.message.rkey &&
						(view.channel === input.channel || view.thread === input.channel)
					) {
						view.seenAt = seenAt;
					}
				}
			}),
		subscribe: (listener) => {
			listeners.add(listener);
			if (listeners.size === 1 && options.live !== false) {
				stopLive = startLive({
					world,
					emit: liveEmit,
					append,
					createMessage,
					applyReaction,
					messagesFor,
					replaceMessage: (ref, rkey, text) => {
						const { list, index, message } = findMessage(ref, rkey);
						const next: MessageView = {
							...message,
							text,
							updatedAt: asDatetime(Date.now()),
						};
						delete next.facets;
						list[index] = next;
						return next;
					},
					removeMessage: (ref, rkey) => {
						const { list, index } = findMessage(ref, rkey);
						list.splice(index, 1);
					},
				});
			}
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0) {
					stopLive?.();
					stopLive = undefined;
				}
			};
		},
		controls: () => controls,
		setControls: (next) => {
			controls = { ...controls, ...next };
		},
	};

	return source;
};
