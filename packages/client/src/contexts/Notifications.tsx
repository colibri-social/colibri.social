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
import {
	cancelChannelTrayNotification,
	isStaleNotificationEvent,
} from "../notifications";
import { createLogger } from "../utils/logger";
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
	pingsForChannel: (channelUri: string) => number;
	hasUnreadMessages: (channelUri: string) => boolean;
	pingsForCommunity: (communityDid: string) => number;
	hasUnreadInCommunity: (communityDid: string) => boolean;
	markMessageSeen: (messageUri: string, channelUri: string) => Promise<void>;
	markChannelRead: (channelUri: string) => void;
	markChannelAsRead: (channelUri: string) => Promise<void>;
	markCommunityAsRead: (communityUri: string) => Promise<void>;
	markCategoryAsRead: (
		communityUri: string,
		channelUris: string[],
	) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue>();

const TEXT_CHANNEL_COLLECTION = "social.colibri.channel.text";

const channelIdentity = (
	channelUri: string,
): { communityDid: string; rkey: string } => {
	const segments = channelUri.replace("at://", "").split("/");
	return { communityDid: segments[0], rkey: segments[segments.length - 1] };
};

const channelKey = (channelUri: string): string => {
	const { communityDid, rkey } = channelIdentity(channelUri);
	return `${communityDid}/${rkey}`;
};

export const channelPath = (channelUri: string): string => {
	const { communityDid, rkey } = channelIdentity(channelUri);
	return `/app/c/${communityDid}/${TEXT_CHANNEL_COLLECTION}/${rkey}`;
};

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

	const markMessageSeen = async (
		messageUri: string,
		channelUri: string,
	): Promise<void> => {
		if (accountedMessages.has(messageUri)) return;
		accountedMessages.add(messageUri);
		void cancelChannelTrayNotification(channelUri);

		adjustPings(channelUri, -1);
		try {
			const res =
				await user.xrpc.social.colibri.notification.updateSeenForMessage(
					messageUri,
				);
			const cleared = (res.ok ? res.data?.clearedPings : 0) ?? 0;
			if (cleared !== 1) adjustPings(channelUri, 1 - cleared);
		} catch {
			adjustPings(channelUri, 1);
		}
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

	const clearChannelPings = async (channelUri: string): Promise<void> => {
		const res =
			await user.xrpc.social.colibri.notification.getUnseen(channelUri);
		const uris = new Set(
			res.ok ? (res.data?.notifications ?? []).map((n) => n.messageUri) : [],
		);
		for (const uri of uris) await markMessageSeen(uri, channelUri);
	};

	const markChannelAsRead = async (channelUri: string): Promise<void> => {
		await advanceCursorToNewest(channelUri);
		await clearChannelPings(channelUri);
	};

	const markCommunityAsRead = async (communityUri: string): Promise<void> => {
		const status =
			await user.xrpc.social.colibri.channel.listUnreadStatus(communityUri);
		if (!status.ok || !status.data) return;
		for (const channel of status.data.channels) {
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
	const seedCommunity = async (communityUri: string): Promise<void> => {
		if (seeded.has(communityUri)) return;
		seeded.add(communityUri);

		let reached = false;

		try {
			const res =
				await user.xrpc.social.colibri.channel.listUnreadStatus(communityUri);
			if (!res.ok) return;

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
			log.error("seeding community notifications failed", { error: err });
		} finally {
			if (!reached) seeded.delete(communityUri);
		}
	};

	createEffect(() => {
		for (const community of user.communities) {
			void seedCommunity(community.uri);
		}
	});

	// ---- Live updates ------------------------------------------------------

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
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

				if (preferences().nativeNotifications) return;
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

	const onVisible = () => {
		if (document.visibilityState === "visible") reseedAll();
	};
	const onFocus = () => reseedAll();

	onMount(() => {
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("focus", onFocus);
	});

	onCleanup(() => {
		document.removeEventListener("visibilitychange", onVisible);
		window.removeEventListener("focus", onFocus);
	});

	const value: NotificationsContextValue = {
		pendingFocus,
		clearPendingFocus,
		pingsForChannel,
		hasUnreadMessages,
		pingsForCommunity,
		hasUnreadInCommunity,
		markMessageSeen,
		markChannelRead,
		markChannelAsRead,
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
