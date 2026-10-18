import { batch, createSignal } from "solid-js";
import { isPingNotification } from "./notification-alerts";
import type { PreferenceStore } from "./preferences/store";
import type { NotificationLevel } from "./preferences/types";
import type { DataSource } from "./source";
import type { Datetime, Did, NotificationView } from "./types";

const MAX_PAGES = 4;

export type NotificationStatus = "loading" | "ready" | "error";

export const isUnread = (notification: NotificationView) =>
	!notification.seenAt;

export const isUnreadPing = (notification: NotificationView) =>
	isUnread(notification) && isPingNotification(notification);

export type NotificationSeenListener = (
	views: readonly NotificationView[],
	seen: boolean,
) => void;

export const createNotificationStore = (
	source: DataSource,
	onSeenChange?: NotificationSeenListener,
) => {
	const [all, setItems] = createSignal<readonly NotificationView[]>([]);
	const [clearedAt, setClearedAt] = createSignal<number>();
	const items = () => {
		const cutoff = clearedAt();
		const current = all();
		return cutoff === undefined
			? current
			: current.filter((entry) => Date.parse(entry.indexedAt) > cutoff);
	};
	const advanceClear = (at: Datetime) =>
		setClearedAt((current) => Math.max(current ?? 0, Date.parse(at)));
	const [status, setStatus] = createSignal<NotificationStatus>("loading");

	const load = async (quiet = false) => {
		if (!quiet) setStatus("loading");
		try {
			const all: NotificationView[] = [];
			let cursor: string | undefined;
			let pages = 0;
			do {
				const page = await source.listNotifications({ limit: 100, cursor });
				all.push(...page.items);
				cursor = page.cursor;
				pages += 1;
			} while (cursor && pages < MAX_PAGES);
			batch(() => {
				setItems((current) => {
					const known = new Set(all.map((entry) => entry.id));
					const live = current.filter((entry) => !known.has(entry.id));
					return [...live, ...all];
				});
				setStatus("ready");
			});
		} catch {
			if (!quiet || status() !== "ready") setStatus("error");
		}
	};

	const applySeenMessage = (
		seenAt: Datetime,
		message: { did: string; rkey: string },
	) => {
		const targets = all().filter(
			(entry) =>
				isUnread(entry) &&
				entry.message?.author.did === message.did &&
				entry.message.rkey === message.rkey,
		);
		if (targets.length === 0) return;
		patch(new Set(targets.map((entry) => entry.id)), seenAt);
		onSeenChange?.(targets, true);
	};

	const applySeen = (seenAt: Datetime, unread: number, global: boolean) => {
		if (global) {
			const cutoff = Date.parse(seenAt);
			const targets = all().filter(
				(entry) => isUnread(entry) && Date.parse(entry.indexedAt) <= cutoff,
			);
			if (targets.length > 0) {
				patch(new Set(targets.map((entry) => entry.id)), seenAt);
				onSeenChange?.(targets, true);
			}
		}
		if (
			global &&
			status() === "ready" &&
			all().filter(isUnreadPing).length !== unread
		) {
			void load();
		}
	};

	source.subscribe((event) => {
		if (event.$type === "seenEvent") {
			if (event.clearedAt) advanceClear(event.clearedAt);
			if (event.message) applySeenMessage(event.seenAt, event.message);
			applySeen(event.seenAt, event.unread, !event.channel);
			return;
		}
		if (event.$type !== "notificationEvent") return;
		const next = event.notification;
		setItems((current) =>
			current.some((entry) => entry.id === next.id)
				? current
				: [next, ...current],
		);
	});

	const patch = (ids: ReadonlySet<string>, seenAt: Datetime | undefined) =>
		setItems((current) =>
			current.map((entry) => {
				if (!ids.has(entry.id)) return entry;
				const copy = { ...entry };
				if (seenAt) copy.seenAt = seenAt;
				else delete copy.seenAt;
				return copy;
			}),
		);

	const markRead = async (ids: readonly string[]) => {
		const targets = all().filter(
			(entry) => ids.includes(entry.id) && isUnread(entry),
		);
		if (targets.length === 0) return;
		const keys = new Set(targets.map((entry) => entry.id));
		patch(keys, new Date().toISOString() as Datetime);
		onSeenChange?.(targets, true);
		try {
			await Promise.all(
				targets.map((entry) =>
					entry.message
						? source.updateSeenForMessage({
								channel: entry.thread ?? entry.channel,
								message: {
									did: entry.message.author.did,
									rkey: entry.message.rkey,
								},
							})
						: Promise.resolve(),
				),
			);
		} catch (error) {
			patch(keys, undefined);
			onSeenChange?.(targets, false);
			throw error;
		}
	};

	const markAllRead = async () => {
		const targets = all().filter(isUnread);
		if (targets.length === 0) return;
		const keys = new Set(targets.map((entry) => entry.id));
		const seenAt = new Date().toISOString() as Datetime;
		patch(keys, seenAt);
		onSeenChange?.(targets, true);
		try {
			await source.updateSeen({ seenAt });
		} catch (error) {
			patch(keys, undefined);
			onSeenChange?.(targets, false);
			throw error;
		}
	};

	const clear = async () => {
		const previous = clearedAt();
		const at = new Date().toISOString() as Datetime;
		const targets = all().filter(isUnread);
		const keys = new Set(targets.map((entry) => entry.id));
		advanceClear(at);
		patch(keys, at);
		if (targets.length > 0) onSeenChange?.(targets, true);
		try {
			await source.clearNotifications({ clearedAt: at });
		} catch (error) {
			setClearedAt(previous);
			patch(keys, undefined);
			if (targets.length > 0) onSeenChange?.(targets, false);
			throw error;
		}
	};

	void load();

	return {
		items,
		status,
		unreadCount: () => items().filter(isUnreadPing).length,
		reload: () => load(),
		refresh: () => load(status() === "ready"),
		markRead,
		markAllRead,
		clear,
	};
};

export type NotificationStore = ReturnType<typeof createNotificationStore>;

export type SpaceNotificationLevel = NotificationLevel;

export const DEFAULT_SPACE_NOTIFICATION_LEVEL: SpaceNotificationLevel = "all";

type SpaceMuteSource = Pick<
	PreferenceStore,
	"isMuted" | "setMuted" | "notificationLevel" | "spaceLevel" | "setSpaceLevel"
>;

const createLocalMutes = (): SpaceMuteSource => {
	const [muted, setMutedSet] = createSignal<ReadonlySet<string>>(new Set());
	const [levels, setLevels] = createSignal<
		Readonly<Record<string, SpaceNotificationLevel>>
	>({});
	return {
		isMuted: (subject) => subject.kind === "actor" && muted().has(subject.did),
		setMuted: async (subject, next) => {
			if (subject.kind !== "actor") return true;
			setMutedSet((current) => {
				if (current.has(subject.did) === next) return current;
				const copy = new Set(current);
				if (next) copy.add(subject.did);
				else copy.delete(subject.did);
				return copy;
			});
			return true;
		},
		notificationLevel: () => DEFAULT_SPACE_NOTIFICATION_LEVEL,
		spaceLevel: (community) => levels()[community],
		setSpaceLevel: async (community, level) => {
			setLevels((current) => {
				const { [community]: _, ...rest } = current;
				return level ? { ...rest, [community]: level } : rest;
			});
			return true;
		},
	};
};

export const createSpaceNotificationPrefs = (
	preferences: SpaceMuteSource = createLocalMutes(),
) => ({
	isMuted: (space: string) =>
		preferences.isMuted({ kind: "actor", did: space as Did }),
	setMuted: (space: string, next: boolean) => {
		void preferences.setMuted({ kind: "actor", did: space as Did }, next);
	},
	level: (space: string) =>
		preferences.spaceLevel(space) ?? preferences.notificationLevel(),
	ownLevel: (space: string) => preferences.spaceLevel(space),
	setLevel: (space: string, level: SpaceNotificationLevel | undefined) => {
		void preferences.setSpaceLevel(space as Did, level);
	},
});

export type SpaceNotificationPrefs = ReturnType<
	typeof createSpaceNotificationPrefs
>;

const spacePrefsByOwner = new WeakMap<object, SpaceNotificationPrefs>();

export const spaceNotificationPrefs = (owner: object) => {
	const owned = (owner as { spaceNotifications?: SpaceNotificationPrefs })
		.spaceNotifications;
	if (owned) return owned;
	const existing = spacePrefsByOwner.get(owner);
	if (existing) return existing;
	const created = createSpaceNotificationPrefs();
	spacePrefsByOwner.set(owner, created);
	return created;
};

export const mutedTotals = <T extends { hasUnread: boolean; mentions: number }>(
	totals: T,
	muted: boolean,
): T => (muted ? { ...totals, hasUnread: false, mentions: 0 } : totals);
