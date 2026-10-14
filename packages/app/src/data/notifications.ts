import { batch, createSignal } from "solid-js";
import type { DataSource } from "./source";
import type { Datetime, NotificationView } from "./types";

const MAX_PAGES = 4;

export type NotificationStatus = "loading" | "ready" | "error";

export const isUnread = (notification: NotificationView) =>
	!notification.seenAt;

export type NotificationSeenListener = (
	views: readonly NotificationView[],
	seen: boolean,
) => void;

export const createNotificationStore = (
	source: DataSource,
	onSeenChange?: NotificationSeenListener,
) => {
	const [all, setItems] = createSignal<readonly NotificationView[]>([]);
	const [cleared, setCleared] = createSignal<ReadonlySet<string>>(new Set());
	const items = () => {
		const hidden = cleared();
		const current = all();
		return hidden.size === 0
			? current
			: current.filter((entry) => !hidden.has(entry.id));
	};
	const [status, setStatus] = createSignal<NotificationStatus>("loading");

	const load = async () => {
		setStatus("loading");
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
			setStatus("error");
		}
	};

	source.subscribe((event) => {
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
		const previous = cleared();
		setCleared(new Set(all().map((entry) => entry.id)));
		try {
			await markAllRead();
		} catch (error) {
			setCleared(previous);
			throw error;
		}
	};

	void load();

	return {
		items,
		status,
		unreadCount: () => items().filter(isUnread).length,
		reload: load,
		markRead,
		markAllRead,
		clear,
	};
};

export type NotificationStore = ReturnType<typeof createNotificationStore>;

export type SpaceNotificationLevel = "all" | "mentionsAndReplies" | "nothing";

export const DEFAULT_SPACE_NOTIFICATION_LEVEL: SpaceNotificationLevel = "all";

export const createSpaceNotificationPrefs = () => {
	const [muted, setMutedSet] = createSignal<ReadonlySet<string>>(new Set());
	const [levels, setLevels] = createSignal<
		Readonly<Record<string, SpaceNotificationLevel>>
	>({});
	return {
		isMuted: (space: string) => muted().has(space),
		setMuted: (space: string, next: boolean) =>
			setMutedSet((current) => {
				if (current.has(space) === next) return current;
				const copy = new Set(current);
				if (next) copy.add(space);
				else copy.delete(space);
				return copy;
			}),
		level: (space: string) =>
			levels()[space] ?? DEFAULT_SPACE_NOTIFICATION_LEVEL,
		setLevel: (space: string, level: SpaceNotificationLevel) =>
			setLevels((current) => ({ ...current, [space]: level })),
	};
};

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
