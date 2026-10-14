import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { createDataStore } from "./store";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const setup = async () => {
	setLatency(0);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	await until(() => store.notifications.status() === "ready");
	return { source, store };
};

describe("notification store", () => {
	it("adds live notifications once and counts them as unread", async () => {
		const { source, store } = await setup();
		const before = store.notifications.unreadCount();
		const sample = store.notifications.items()[0];
		if (!sample) throw new Error("no notifications");
		const live = {
			...sample,
			id: "live:1",
			indexedAt: new Date().toISOString(),
		};
		delete (live as { seenAt?: string }).seenAt;
		source.emit({ $type: "notificationEvent", notification: live as never });
		source.emit({ $type: "notificationEvent", notification: live as never });
		expect(store.notifications.items()[0]?.id).toBe("live:1");
		expect(store.notifications.unreadCount()).toBe(before + 1);
	});

	it("rolls back an optimistic mark read when the server fails", async () => {
		const { source, store } = await setup();
		const target = store.notifications.items().find((entry) => !entry.seenAt);
		if (!target) throw new Error("no unread notification");
		source.updateSeenForMessage = async () => {
			throw new Error("offline");
		};
		const marking = store.notifications.markRead([target.id]);
		expect(
			store.notifications.items().find((entry) => entry.id === target.id)
				?.seenAt,
		).toBeTruthy();
		await expect(marking).rejects.toThrow("offline");
		expect(
			store.notifications.items().find((entry) => entry.id === target.id)
				?.seenAt,
		).toBeUndefined();
	});

	it("persists mark all read in the source", async () => {
		const { source, store } = await setup();
		await store.notifications.markAllRead();
		expect(store.notifications.unreadCount()).toBe(0);
		const page = await source.listNotifications({ limit: 100 });
		expect(page.items.every((entry) => !!entry.seenAt)).toBe(true);
	});

	it("clears the inbox until new notifications arrive", async () => {
		const { source, store } = await setup();
		const sample = store.notifications.items()[0];
		if (!sample) throw new Error("no notifications");
		await store.notifications.clear();
		expect(store.notifications.items()).toHaveLength(0);
		expect(store.notifications.unreadCount()).toBe(0);
		const page = await source.listNotifications({ limit: 100 });
		expect(page.items.every((entry) => !!entry.seenAt)).toBe(true);
		await store.notifications.reload();
		expect(store.notifications.items()).toHaveLength(0);
		const live = {
			...sample,
			id: "live:cleared",
			indexedAt: new Date().toISOString(),
		};
		delete (live as { seenAt?: string }).seenAt;
		source.emit({ $type: "notificationEvent", notification: live as never });
		expect(store.notifications.items().map((entry) => entry.id)).toEqual([
			"live:cleared",
		]);
		expect(store.notifications.unreadCount()).toBe(1);
	});

	it("restores the inbox when clearing fails", async () => {
		const { source, store } = await setup();
		const before = store.notifications.items().length;
		const unread = store.notifications.unreadCount();
		source.updateSeen = async () => {
			throw new Error("offline");
		};
		const clearing = store.notifications.clear();
		expect(store.notifications.items()).toHaveLength(0);
		await expect(clearing).rejects.toThrow("offline");
		expect(store.notifications.items()).toHaveLength(before);
		expect(store.notifications.unreadCount()).toBe(unread);
	});
});
