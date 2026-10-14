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
	const [items, setItems] = createSignal<readonly NotificationView[]>([]);
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
		const targets = items().filter(
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
		const targets = items().filter(isUnread);
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

	void load();

	return {
		items,
		status,
		unreadCount: () => items().filter(isUnread).length,
		reload: load,
		markRead,
		markAllRead,
	};
};

export type NotificationStore = ReturnType<typeof createNotificationStore>;
