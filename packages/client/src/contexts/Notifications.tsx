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
import { writeReadCursor } from "../atproto/read-cursor";
import { classifyThrown } from "../errors/classify";
import { isGoneCode } from "../errors/codes";
import {
	cancelChannelTrayNotification,
	isAppUnfocused,
	isStaleNotificationEvent,
} from "../notifications";
import { channelIdentity, channelPath } from "../utils/at-uri";
import { createLogger } from "../utils/logger";
import { canAdvanceCursor, clearableNotifications } from "./deferred-mark-read";
import { useMutes } from "./Mutes";
import { useSocketContext } from "./Socket";
import { useSounds } from "./Sounds";
import { useUserContext } from "./User";
import { useUserPreferences } from "./UserPreferences";

const log = createLogger("notif");

/**
 * A message the user has been routed to via a notification toast but has not
 * yet seen. The channel layout consumes this to scroll the message into view
 * and, once it's actually visible, mark the notification as read.
 */
export type PendingNotificationFocus = {
	channelUri: string;
	messageUri: string;
	indexedAt: string;
};

type NotificationsContextValue = {
	pendingFocus: Accessor<PendingNotificationFocus | undefined>;
	clearPendingFocus: () => void;
	openNotification: (target: PendingNotificationFocus) => void;
	pingsForChannel: (channelUri: string) => number;
	hasUnreadMessages: (channelUri: string) => boolean;
	pingsForCommunity: (communityDid: string) => number;
	hasUnreadInCommunity: (communityDid: string) => boolean;
	totalPings: () => number;
	markMessageSeen: (
		messageUri: string,
		channelUri: string,
		isPing: boolean,
	) => Promise<void>;
	markChannelRead: (channelUri: string) => void;
	markChannelAsRead: (channelUri: string) => Promise<void>;
	markChannelReadUpTo: (
		channelUri: string,
		messageUri: string | undefined,
		actionedAt: number,
	) => Promise<void>;
	markCommunityAsRead: (communityUri: string) => Promise<void>;
	markCategoryAsRead: (
		communityUri: string,
		channelUris: string[],
	) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue>();

const channelKey = (channelUri: string): string => {
	const { communityDid, rkey } = channelIdentity(channelUri);
	return `${communityDid}/${rkey}`;
};

export { channelPath };

export const isSameChannelUri = (a: string, b: string): boolean => {
	const x = channelIdentity(a);
	const y = channelIdentity(b);
	return x.communityDid === y.communityDid && x.rkey === y.rkey;
};

const isViewingChannel = (pathname: string, channelUri: string): boolean => {
	const { communityDid, rkey } = channelIdentity(channelUri);
	return (
		pathname.startsWith("/app/c/") &&
		pathname.includes(communityDid) &&
		pathname.endsWith(`/${rkey}`)
	);
};

const kindLabel = (kind: string, mentionRoleName?: string): string => {
	if (kind === "reply") return "Replied to you";
	if (kind === "message") return "New message";
	if (mentionRoleName) return `Mentioned you via @${mentionRoleName}`;
	return "Mentioned you";
};

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

	const [pingCounts, setPingCounts] = createSignal<Record<string, number>>({});
	const [unreadChannels, setUnreadChannels] = createSignal<
		Record<string, true>
	>({});

	const accountedMessages = new Set<string>();
	const locallyReadChannels = new Set<string>();

	const clearPendingFocus = () => setPendingFocus(undefined);

	const openNotification = (target: PendingNotificationFocus) => {
		setPendingFocus(target);
		navigate(channelPath(target.channelUri));
	};

	// ---- Accessors ---------------------------------------------------------
	const pingsForChannel = (channelUri: string): number =>
		mutes.isChannelMuted(channelUri)
			? 0
			: (pingCounts()[channelKey(channelUri)] ?? 0);

	const hasUnreadMessages = (channelUri: string): boolean =>
		!mutes.isChannelMuted(channelUri) &&
		!!unreadChannels()[channelKey(channelUri)];

	const pingsForCommunity = (communityDid: string): number => {
		const counts = pingCounts();
		let total = 0;
		const prefix = `${communityDid}/`;
		for (const key in counts) {
			if (key.startsWith(prefix) && !mutes.isChannelKeyMuted(key))
				total += counts[key];
		}
		return total;
	};

	const totalPings = (): number => {
		const counts = pingCounts();
		let total = 0;
		for (const key in counts) {
			if (!mutes.isChannelKeyMuted(key)) total += counts[key];
		}
		return total;
	};

	const hasUnreadInCommunity = (communityDid: string): boolean => {
		const channels = unreadChannels();
		const prefix = `${communityDid}/`;
		for (const key in channels) {
			if (key.startsWith(prefix) && !mutes.isChannelKeyMuted(key)) return true;
		}
		return false;
	};

	// ---- Mutators ----------------------------------------------------------
	const adjustPings = (channelUri: string, delta: number) =>
		setPingCounts((prev) => {
			const key = channelKey(channelUri);
			const current = prev[key] ?? 0;
			const next = Math.max(0, current + delta);
			if (next === current) return prev;
			return { ...prev, [key]: next };
		});

	const setChannelPings = (channelUri: string, count: number) => {
		setPingCounts((prev) => {
			const key = channelKey(channelUri);
			const next = Math.max(0, count);
			if ((prev[key] ?? 0) === next) return prev;
			return { ...prev, [key]: next };
		});
	};

	const addUnreadChannel = (channelUri: string) =>
		setUnreadChannels((prev) => {
			const key = channelKey(channelUri);
			if (prev[key]) return prev;
			return { ...prev, [key]: true };
		});

	const markChannelRead = (channelUri: string) => {
		locallyReadChannels.add(channelKey(channelUri));
		setUnreadChannels((prev) => {
			const key = channelKey(channelUri);
			if (!prev[key]) return prev;
			const next = { ...prev };
			delete next[key];
			return next;
		});
	};

	const sendMessageSeen = async (messageUri: string): Promise<boolean> => {
		try {
			const res =
				await user.xrpc.social.colibri.notification.updateSeenForMessage(
					messageUri,
				);
			return res.ok;
		} catch {
			return false;
		}
	};

	const markMessageSeen = async (
		messageUri: string,
		channelUri: string,
		isPing: boolean,
	): Promise<void> => {
		if (accountedMessages.has(messageUri)) return;
		accountedMessages.add(messageUri);
		void cancelChannelTrayNotification(channelUri);

		if (isPing) adjustPings(channelUri, -1);

		const sent = await sendMessageSeen(messageUri);
		if (sent) return;

		accountedMessages.delete(messageUri);
		if (isPing) adjustPings(channelUri, 1);
	};

	const applyRemoteMessageSeen = (
		messageUri: string,
		channelUri: string,
		cleared: number,
	) => {
		if (accountedMessages.has(messageUri)) return;
		accountedMessages.add(messageUri);
		adjustPings(channelUri, -cleared);
	};

	// ---- "Mark as read" actions -------------------------------------------

	const advanceCursorToNewest = async (channelUri: string): Promise<void> => {
		const res = await user.xrpc.social.colibri.channel.listMessages(
			channelUri,
			1,
		);
		const newest = res.ok ? res.data?.messages?.[0]?.uri : undefined;
		if (!newest) return;
		await writeReadCursor(user.did, channelUri, newest);
		markChannelRead(channelUri);
	};

	const clearChannelPings = async (
		channelUri: string,
		before?: number,
	): Promise<void> => {
		const res =
			await user.xrpc.social.colibri.notification.getUnseen(channelUri);
		if (!res.ok) return;

		const pending = clearableNotifications(
			res.data?.notifications ?? [],
			before,
		);
		const uris = new Set(pending.map((n) => n.messageUri));

		void cancelChannelTrayNotification(channelUri);

		let allSent = true;
		for (const uri of uris) {
			const sent = await sendMessageSeen(uri);
			if (sent) accountedMessages.add(uri);
			else allSent = false;
		}

		if (allSent && before === undefined) setChannelPings(channelUri, 0);
		else if (allSent) adjustPings(channelUri, -uris.size);
	};

	const markChannelAsRead = async (channelUri: string): Promise<void> => {
		await advanceCursorToNewest(channelUri);
		await clearChannelPings(channelUri);
	};

	const markChannelReadUpTo = async (
		channelUri: string,
		messageUri: string | undefined,
		actionedAt: number,
	): Promise<void> => {
		if (!messageUri) {
			await markChannelAsRead(channelUri);
			return;
		}

		const existing =
			await user.xrpc.social.colibri.channel.getReadCursor(channelUri);
		const current = existing.ok ? existing.data?.cursor : undefined;
		if (!canAdvanceCursor(current, messageUri)) return;

		await writeReadCursor(user.did, channelUri, messageUri);

		const res = await user.xrpc.social.colibri.channel.listMessages(
			channelUri,
			1,
		);
		const newest = res.ok ? res.data?.messages?.[0]?.uri : undefined;
		if (!newest || newest === messageUri) markChannelRead(channelUri);

		await clearChannelPings(channelUri, actionedAt);
	};

	const markCommunityAsRead = async (communityUri: string): Promise<void> => {
		const status =
			await user.xrpc.social.colibri.channel.listUnreadStatus(communityUri);
		if (!status.ok || !status.data) return;
		for (const channel of status.data.channels) {
			setChannelPings(channel.channelUri, channel.unreadPingCount);
			if (channel.hasUnreadMessages) {
				await advanceCursorToNewest(channel.channelUri);
			}
			if (channel.unreadPingCount > 0) {
				await clearChannelPings(channel.channelUri);
			}
		}
	};

	const markCategoryAsRead = async (
		communityUri: string,
		channelUris: string[],
	): Promise<void> => {
		const status =
			await user.xrpc.social.colibri.channel.listUnreadStatus(communityUri);
		if (!status.ok || !status.data) return;
		const inCategory = new Set(channelUris);
		for (const channel of status.data.channels) {
			if (!inCategory.has(channel.channelUri)) continue;
			setChannelPings(channel.channelUri, channel.unreadPingCount);
			if (channel.hasUnreadMessages) {
				await advanceCursorToNewest(channel.channelUri);
			}
			if (channel.unreadPingCount > 0) {
				await clearChannelPings(channel.channelUri);
			}
		}
	};

	// ---- Seeding -----------------------------------------------------------

	const seeded = new Set<string>();
	const blocked = new Set<string>();
	const seedCommunity = async (communityUri: string): Promise<void> => {
		if (seeded.has(communityUri) || blocked.has(communityUri)) return;
		seeded.add(communityUri);

		let reached = false;

		try {
			const res =
				await user.xrpc.social.colibri.channel.listUnreadStatus(communityUri);
			if (!res.ok) {
				if (isGoneCode(res.error.code)) {
					blocked.add(communityUri);
					log.warn("unread seeding blocked", {
						community: communityUri,
						code: res.error.code,
					});
				}
				return;
			}

			reached = true;

			const status = res.data;
			if (!status?.channels) return;

			setPingCounts((prev) => {
				const next = { ...prev };
				for (const ch of status.channels) {
					if (mutes.isChannelMuted(ch.channelUri)) continue;
					next[channelKey(ch.channelUri)] = ch.unreadPingCount;
				}
				return next;
			});

			setUnreadChannels((prev) => {
				const next = { ...prev };
				for (const ch of status.channels) {
					const key = channelKey(ch.channelUri);
					if (mutes.isChannelMuted(ch.channelUri)) {
						delete next[key];
						continue;
					}
					if (locallyReadChannels.has(key)) {
						delete next[key];
						continue;
					}
					if (ch.hasUnreadMessages) next[key] = true;
					else delete next[key];
				}
				return next;
			});
		} catch (err) {
			log.error("seeding community notifications failed", {
				code: classifyThrown(err).code,
			});
		} finally {
			if (!reached) seeded.delete(communityUri);
		}
	};

	createEffect(() => {
		const known = new Set<string>(
			user.communities.map((community) => community.uri),
		);
		for (const uri of blocked) {
			if (!known.has(uri)) blocked.delete(uri);
		}
		for (const uri of known) {
			void seedCommunity(uri);
		}
	});

	// ---- Live updates ------------------------------------------------------

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (
				event.type === "member_event" &&
				event.data?.event === "join" &&
				event.data.member.did === user.did
			) {
				const { community } = event.data;
				blocked.delete(community);
				seeded.delete(community);
				void seedCommunity(community);
				return;
			}

			if (event.type === "notification_event") {
				if (!event.data) return;
				const data = event.data;

				if (isViewingChannel(location.pathname, data.channelUri)) return;

				if (mutes.isChannelMuted(data.channelUri)) return;

				const isPing = data.kind === "mention" || data.kind === "reply";
				const isStale = isStaleNotificationEvent(data.indexedAt);

				if (isPing) {
					adjustPings(data.channelUri, 1);
					if (!isStale) playSound("ping");
				}

				if (preferences().nativeNotifications && isAppUnfocused()) return;
				if (isStale) return;

				const target: PendingNotificationFocus = {
					channelUri: data.channelUri,
					messageUri: data.messageUri,
					indexedAt: data.indexedAt,
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
								{kindLabel(data.kind, data.mentionRoleName)}
							</span>
							{data.message.text ? (
								<span class="line-clamp-2 text-sm">{data.message.text}</span>
							) : null}
						</button>
					),
					{ unstyled: true, duration: 8000 },
				);
				return;
			}

			if (event.type === "message_event") {
				if (event.data?.event !== "upsert") return;
				const data = event.data;

				if (data.author.did === user.did) return;
				if (isViewingChannel(location.pathname, data.channel)) return;
				if (mutes.isChannelMuted(data.channel)) return;

				addUnreadChannel(data.channel);

				return;
			}

			if (event.type === "seen_event") {
				if (!event.data) return;

				const data = event.data;

				if (data.event === "channel_read") {
					markChannelRead(data.channelUri);
				} else if (data.event === "message_seen") {
					applyRemoteMessageSeen(
						data.messageUri,
						data.channelUri,
						data.cleared,
					);
				}
			}
		});

		onCleanup(cleanup);
	});

	const reseedAll = (): void => {
		for (const community of user.communities) {
			if (blocked.has(community.uri)) continue;
			seeded.delete(community.uri);
			void seedCommunity(community.uri);
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
