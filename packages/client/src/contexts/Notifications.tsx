import { useLocation, useNavigate } from "@solidjs/router";
import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	type ParentComponent,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { buildThreadPath } from "../atproto/colibri-channel-url";
import { colibri } from "../atproto/lexicons";
import { adoptRemoteCursors, recordRead } from "../atproto/read-cursor";
import { classifyThrown } from "../errors/classify";
import { isGoneCode } from "../errors/codes";
import {
	cancelChannelTrayNotification,
	isAppUnfocused,
	isPingKind,
	isStaleNotificationEvent,
} from "../notifications";
import { channelIdentity, channelPath, messageIdentity } from "../utils/at-uri";
import { createLogger } from "../utils/logger";
import { clearableNotifications } from "./deferred-mark-read";
import { useMutes } from "./Mutes";
import { useSocketContext } from "./Socket";
import { useSounds } from "./Sounds";
import { useUserContext } from "./User";
import { useUserPreferences } from "./UserPreferences";

const log = createLogger("notif");

export type PendingNotificationFocus = {
	channel: string;
	thread?: string;
	messageUri?: string;
	indexedAt: string;
};

export const notificationFocusSpace = (
	target: PendingNotificationFocus,
): string => target.thread ?? target.channel;

type ChannelEntry = {
	pings: number;
	hasUnread: boolean;
};

type NotificationsContextValue = {
	pendingFocus: Accessor<PendingNotificationFocus | undefined>;
	clearPendingFocus: () => void;
	openNotification: (target: PendingNotificationFocus) => void;
	pingsForChannel: (channel: string) => number;
	hasUnreadMessages: (channel: string) => boolean;
	pingsForCommunity: (communityDid: string) => number;
	hasUnreadInCommunity: (communityDid: string) => boolean;
	totalPings: () => number;
	markMessageSeen: (
		messageUri: string,
		channel: string,
		isPing: boolean,
	) => Promise<void>;
	markChannelRead: (channel: string) => void;
	markChannelAsRead: (channel: string) => Promise<void>;
	markChannelReadUpTo: (
		channel: string,
		messageUri: string | undefined,
		actionedAt: number,
	) => Promise<void>;
	markCommunityAsRead: (communityDid: string) => Promise<void>;
	markCategoryAsRead: (
		communityDid: string,
		channels: string[],
	) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue>();

export { channelPath };

export const isSameChannelUri = (a: string, b: string): boolean => {
	const x = channelIdentity(a);
	const y = channelIdentity(b);
	return x.communityDid === y.communityDid && x.rkey === y.rkey;
};

const isViewingChannel = (pathname: string, channel: string): boolean => {
	const { communityDid, rkey } = channelIdentity(channel);
	return (
		pathname.startsWith("/app/c/") &&
		pathname.includes(communityDid) &&
		pathname.endsWith(`/${rkey}`)
	);
};

const kindLabel = (kind: string, mentionRole?: string): string => {
	if (kind === "reply") return "Replied to you";
	if (kind === "message") return "New message";
	if (mentionRole) return `Mentioned you via @${mentionRole}`;
	return "Mentioned you";
};

const messageRefKey = (did: string, rkey: string): string => `${did}/${rkey}`;

const NOTIFICATION_EVENT = "social.colibri.beta.sync.defs#notificationEvent";
const MESSAGE_EVENT = "social.colibri.beta.sync.defs#messageEvent";
const MEMBER_EVENT = "social.colibri.beta.sync.defs#memberEvent";
const SEEN_EVENT = "social.colibri.beta.sync.defs#seenEvent";

export const NotificationsContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const socket = useSocketContext();
	const mutes = useMutes();
	const { preferences } = useUserPreferences();
	const navigate = useNavigate();
	const location = useLocation();
	const { playSound } = useSounds();

	const [pendingFocus, setPendingFocus] = createSignal<
		PendingNotificationFocus | undefined
	>(undefined);

	const [channels, setChannels] = createSignal<Record<string, ChannelEntry>>(
		{},
	);

	const accountedMessageRefs = new Set<string>();
	const notifiedIds = new Set<string>();
	const locallyReadChannels = new Set<string>();

	const clearPendingFocus = () => setPendingFocus(undefined);

	const pathFor = (target: PendingNotificationFocus): string => {
		const thread = target.thread;
		if (thread === undefined) return channelPath(target.channel);
		return (
			buildThreadPath(target.channel, thread) ?? channelPath(target.channel)
		);
	};

	const openNotification = (target: PendingNotificationFocus) => {
		setPendingFocus(target);
		navigate(pathFor(target));
	};

	const communityOf = (channel: string): string =>
		channelIdentity(channel).communityDid;

	// ---- Accessors ---------------------------------------------------------
	const pingsForChannel = (channel: string): number =>
		mutes.isCommunityMuted(communityOf(channel))
			? 0
			: (channels()[channel]?.pings ?? 0);

	const hasUnreadMessages = (channel: string): boolean =>
		!mutes.isCommunityMuted(communityOf(channel)) &&
		!!channels()[channel]?.hasUnread;

	const pingsForCommunity = (communityDid: string): number => {
		if (mutes.isCommunityMuted(communityDid)) return 0;
		const state = channels();
		let total = 0;
		for (const channel in state) {
			if (communityOf(channel) === communityDid) total += state[channel].pings;
		}
		return total;
	};

	const hasUnreadInCommunity = (communityDid: string): boolean => {
		if (mutes.isCommunityMuted(communityDid)) return false;
		const state = channels();
		for (const channel in state) {
			if (communityOf(channel) === communityDid && state[channel].hasUnread) {
				return true;
			}
		}
		return false;
	};

	const totalPings = (): number => {
		const state = channels();
		let total = 0;
		for (const channel in state) {
			if (!mutes.isCommunityMuted(communityOf(channel))) {
				total += state[channel].pings;
			}
		}
		return total;
	};

	// ---- Mutators ----------------------------------------------------------
	const adjustPings = (channel: string, delta: number) =>
		setChannels((prev) => {
			const current = prev[channel] ?? { pings: 0, hasUnread: false };
			const next = Math.max(0, current.pings + delta);
			if (next === current.pings) return prev;
			return { ...prev, [channel]: { ...current, pings: next } };
		});

	const setChannelPings = (channel: string, count: number) =>
		setChannels((prev) => {
			const current = prev[channel] ?? { pings: 0, hasUnread: false };
			const next = Math.max(0, count);
			if (current.pings === next) return prev;
			return { ...prev, [channel]: { ...current, pings: next } };
		});

	const markChannelUnread = (channel: string) =>
		setChannels((prev) => {
			const current = prev[channel];
			if (current?.hasUnread) return prev;
			return {
				...prev,
				[channel]: { pings: current?.pings ?? 0, hasUnread: true },
			};
		});

	const clearChannelUnread = (channel: string) =>
		setChannels((prev) => {
			const current = prev[channel];
			if (!current?.hasUnread) return prev;
			return { ...prev, [channel]: { ...current, hasUnread: false } };
		});

	const markChannelRead = (channel: string) => {
		locallyReadChannels.add(channel);
		clearChannelUnread(channel);
	};

	const sendMessageSeen = async (
		channel: string,
		did: string,
		rkey: string,
	): Promise<boolean> => {
		const res = await user.xrpc.queued(
			colibri.notification.updateSeenForMessage.main,
			{ body: { channel, message: { did, rkey } } },
			{ label: "notification.updateSeenForMessage" },
		);
		return res.ok;
	};

	const markMessageSeen = async (
		messageUri: string,
		channel: string,
		isPing: boolean,
	): Promise<void> => {
		const message = messageIdentity(messageUri);
		if (!message) {
			log.warn("skipping seen update for unparsable message uri", {
				code: "notif.message_uri_unparsable",
			});
			return;
		}

		const { did, rkey } = message;
		const refKey = messageRefKey(did, rkey);
		if (accountedMessageRefs.has(refKey)) return;
		accountedMessageRefs.add(refKey);
		void cancelChannelTrayNotification(channel);

		if (isPing) adjustPings(channel, -1);

		const sent = await sendMessageSeen(channel, did, rkey);
		if (sent) return;

		accountedMessageRefs.delete(refKey);
		if (isPing) adjustPings(channel, 1);
	};

	// ---- "Mark as read" actions -------------------------------------------

	const newestMessageRkey = async (
		channel: string,
	): Promise<string | undefined> => {
		const res = await user.xrpc.call(colibri.channel.listMessages.main, {
			params: { channel, limit: 1 },
		});
		return res.ok ? res.data?.messages?.[0]?.rkey : undefined;
	};

	const advanceCursorToNewest = async (channel: string): Promise<void> => {
		const rkey = await newestMessageRkey(channel);
		if (!rkey) return;
		const { communityDid, rkey: channelKey } = channelIdentity(channel);
		recordRead(communityDid, channelKey, rkey);
		markChannelRead(channel);
	};

	const clearChannelPings = async (
		channel: string,
		before?: number,
	): Promise<void> => {
		const res = await user.xrpc.call(colibri.notification.getUnseen.main, {
			params: { channel },
		});
		if (!res.ok) return;

		const pending = clearableNotifications(
			res.data?.notifications ?? [],
			before,
		);

		void cancelChannelTrayNotification(channel);

		let cleared = 0;
		let allSent = true;

		for (const notification of pending) {
			if (!notification.message) {
				allSent = false;
				continue;
			}

			const did = notification.message.author.did;
			const rkey = notification.message.rkey;
			const refKey = messageRefKey(did, rkey);

			let sent = accountedMessageRefs.has(refKey);
			if (!sent) sent = await sendMessageSeen(channel, did, rkey);

			if (sent) {
				accountedMessageRefs.add(refKey);
				if (isPingKind(notification.kind)) cleared++;
			} else {
				allSent = false;
			}
		}

		if (allSent && before === undefined) setChannelPings(channel, 0);
		else if (cleared > 0) adjustPings(channel, -cleared);
	};

	const markChannelAsRead = async (channel: string): Promise<void> => {
		await advanceCursorToNewest(channel);
		await clearChannelPings(channel);
	};

	const markChannelReadUpTo = async (
		channel: string,
		messageUri: string | undefined,
		actionedAt: number,
	): Promise<void> => {
		if (!messageUri) {
			await markChannelAsRead(channel);
			return;
		}

		const message = messageIdentity(messageUri);
		if (!message) {
			await markChannelAsRead(channel);
			return;
		}

		const { communityDid, rkey: channelKey } = channelIdentity(channel);
		const messageRkey = message.rkey;
		recordRead(communityDid, channelKey, messageRkey);

		const newest = await newestMessageRkey(channel);
		if (!newest || newest === messageRkey) markChannelRead(channel);

		await clearChannelPings(channel, actionedAt);
	};

	const markCommunityAsRead = async (communityDid: string): Promise<void> => {
		const status = await user.xrpc.call(colibri.channel.listUnreadStatus.main, {
			params: { community: communityDid },
		});
		if (!status.ok || !status.data) return;
		for (const channelStatus of status.data.statuses) {
			setChannelPings(channelStatus.channel, channelStatus.unreadMentions);
			if (channelStatus.hasUnread) {
				await advanceCursorToNewest(channelStatus.channel);
			}
			if (channelStatus.unreadMentions > 0) {
				await clearChannelPings(channelStatus.channel);
			}
		}
	};

	const markCategoryAsRead = async (
		communityDid: string,
		channels: string[],
	): Promise<void> => {
		const status = await user.xrpc.call(colibri.channel.listUnreadStatus.main, {
			params: { community: communityDid },
		});
		if (!status.ok || !status.data) return;
		const inCategory = new Set(channels);
		for (const channelStatus of status.data.statuses) {
			if (!inCategory.has(channelStatus.channel)) continue;
			setChannelPings(channelStatus.channel, channelStatus.unreadMentions);
			if (channelStatus.hasUnread) {
				await advanceCursorToNewest(channelStatus.channel);
			}
			if (channelStatus.unreadMentions > 0) {
				await clearChannelPings(channelStatus.channel);
			}
		}
	};

	// ---- Seeding -----------------------------------------------------------

	const seeded = new Set<string>();
	const blocked = new Set<string>();
	const seedCommunity = async (communityDid: string): Promise<void> => {
		if (seeded.has(communityDid) || blocked.has(communityDid)) return;
		seeded.add(communityDid);

		let reached = false;

		try {
			const res = await user.xrpc.call(colibri.channel.listUnreadStatus.main, {
				params: { community: communityDid },
			});
			if (!res.ok) {
				if (isGoneCode(res.error.code)) {
					blocked.add(communityDid);
					log.warn("unread seeding blocked", {
						community: communityDid,
						code: res.error.code,
					});
				}
				return;
			}

			reached = true;

			const statuses = res.data?.statuses;
			if (!statuses) return;

			adoptRemoteCursors(
				communityDid,
				statuses.flatMap((status) =>
					status.cursor
						? [
								{
									channel: channelIdentity(status.channel).rkey,
									cursor: status.cursor,
								},
							]
						: [],
				),
			);

			setChannels((prev) => {
				const next = { ...prev };
				for (const status of statuses) {
					if (locallyReadChannels.has(status.channel)) {
						next[status.channel] = { pings: 0, hasUnread: false };
						continue;
					}
					next[status.channel] = {
						pings: status.unreadMentions,
						hasUnread: status.hasUnread,
					};
				}
				return next;
			});
		} catch (err) {
			log.error("seeding community notifications failed", {
				code: classifyThrown(err).code,
			});
		} finally {
			if (!reached) seeded.delete(communityDid);
		}
	};

	createEffect(() => {
		const known = new Set<string>(user.communities.map((c) => c.did));
		for (const did of blocked) {
			if (!known.has(did)) blocked.delete(did);
		}
		for (const did of known) {
			void seedCommunity(did);
		}
	});

	// ---- Live updates ------------------------------------------------------

	const resyncChannelPings = async (channel: string): Promise<void> => {
		const res = await user.xrpc.call(colibri.notification.getUnseen.main, {
			params: { channel },
		});
		if (!res.ok || !res.data) return;
		const pings = res.data.notifications.filter((n) =>
			isPingKind(n.kind),
		).length;
		setChannelPings(channel, pings);
	};

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (event.$type === MEMBER_EVENT) {
				if (event.event === "join" && event.member?.actor.did === user.did) {
					blocked.delete(event.community);
					seeded.delete(event.community);
					void seedCommunity(event.community);
				}
				return;
			}

			if (event.$type === NOTIFICATION_EVENT) {
				const notification = event.notification;

				const space = notification.thread ?? notification.channel;
				if (isViewingChannel(location.pathname, space)) return;
				if (mutes.isCommunityMuted(notification.community)) return;
				if (mutes.isMuted(notification.author.did)) return;
				if (notifiedIds.has(notification.id)) return;
				notifiedIds.add(notification.id);

				const isPing = isPingKind(notification.kind);
				const isStale = isStaleNotificationEvent(notification.indexedAt);

				if (isPing) {
					adjustPings(notification.channel, 1);
					if (!isStale) playSound("ping");
				}

				if (preferences().nativeNotifications && isAppUnfocused()) return;
				if (isStale) return;

				const target: PendingNotificationFocus = {
					channel: notification.channel,
					...(notification.thread ? { thread: notification.thread } : {}),
					messageUri: notification.message?.uri,
					indexedAt: notification.indexedAt,
				};

				toast.custom(
					(id) => (
						<button
							type="button"
							onClick={() => {
								openNotification(target);
								toast.dismiss(id);
							}}
							class="flex w-full flex-col items-start gap-0.5 rounded-md border border-border bg-popover p-3 text-left text-popover-foreground shadow-md cursor-pointer hover:bg-muted/50"
						>
							<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								{kindLabel(notification.kind, notification.mentionRole)}
							</span>
							{notification.message?.text ? (
								<span class="line-clamp-2 text-sm">
									{notification.message.text}
								</span>
							) : null}
						</button>
					),
					{ id: notification.id, unstyled: true, duration: 8000 },
				);
				return;
			}

			if (event.$type === MESSAGE_EVENT) {
				if (event.event !== "create" || !event.message) return;
				const message = event.message;

				if (message.author.did === user.did) {
					const { communityDid, rkey: channelKey } = channelIdentity(
						event.channel,
					);
					recordRead(communityDid, channelKey, message.rkey);
					clearChannelUnread(event.channel);
					return;
				}
				if (isViewingChannel(location.pathname, event.channel)) return;
				if (mutes.isCommunityMuted(communityOf(event.channel))) return;
				if (mutes.isMuted(message.author.did)) return;

				markChannelUnread(event.channel);
				return;
			}

			if (event.$type === SEEN_EVENT) {
				if (event.channel) void resyncChannelPings(event.channel);
				else {
					setChannels((prev) => {
						const next: Record<string, ChannelEntry> = {};
						for (const channel in prev) {
							next[channel] = { ...prev[channel], pings: 0 };
						}
						return next;
					});
				}
			}
		});

		onCleanup(cleanup);
	});

	const reseedAll = (): void => {
		for (const community of user.communities) {
			if (blocked.has(community.did)) continue;
			seeded.delete(community.did);
			void seedCommunity(community.did);
		}
	};

	let sawConnected = false;
	createEffect(() => {
		const isConnected = socket.connected();
		if (!isConnected) return;
		if (sawConnected) reseedAll();
		sawConnected = true;
	});

	let hadFocus = true;

	const onBlur = () => {
		if (!document.hasFocus()) hadFocus = false;
	};

	const onFocus = () => {
		if (hadFocus || !document.hasFocus()) return;
		hadFocus = true;
		reseedAll();
	};

	const onVisible = () => {
		if (document.visibilityState !== "visible") return;
		hadFocus = document.hasFocus();
		reseedAll();
	};

	onMount(() => {
		hadFocus = document.hasFocus();
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("focus", onFocus);
		window.addEventListener("blur", onBlur);
	});

	onCleanup(() => {
		document.removeEventListener("visibilitychange", onVisible);
		window.removeEventListener("focus", onFocus);
		window.removeEventListener("blur", onBlur);
	});

	const value: NotificationsContextValue = {
		pendingFocus,
		clearPendingFocus,
		openNotification,
		pingsForChannel,
		hasUnreadMessages,
		pingsForCommunity,
		hasUnreadInCommunity,
		totalPings,
		markMessageSeen,
		markChannelRead,
		markChannelAsRead,
		markChannelReadUpTo,
		markCommunityAsRead,
		markCategoryAsRead,
	};

	return (
		<NotificationsContext.Provider value={value}>
			{props.children}
		</NotificationsContext.Provider>
	);
};

export const useNotifications = (): NotificationsContextValue => {
	const ctx = useContext(NotificationsContext);
	if (!ctx)
		throw new Error(
			"useNotifications called outside NotificationsContextProvider",
		);
	return ctx;
};
