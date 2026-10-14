import { describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { spaceNotificationPrefs } from "./notifications";
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
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq."));
	if (!hq) throw new Error("HQ missing");
	const space = store.space(hq);
	await until(() => !!space.channels.value());
	return { source, store, hq, space };
};

describe("Space notification prefs in the store", () => {
	it("shares one prefs object and drops muted Space totals", async () => {
		const { store, hq, space } = await setup();
		expect(spaceNotificationPrefs(store)).toBe(store.spaceNotifications);
		await until(() => space.totals().hasUnread || space.totals().mentions > 0);
		store.spaceNotifications.setMuted(hq.did, true);
		expect(space.totals()).toEqual({ hasUnread: false, mentions: 0 });
		store.spaceNotifications.setMuted(hq.did, false);
		expect(space.totals().hasUnread || space.totals().mentions > 0).toBe(true);
	});
});

describe("threadsOf", () => {
	it("loads threads without opening the channel", async () => {
		const { source, store, space } = await setup();
		const calls: string[] = [];
		const listMessages = source.listMessages;
		source.listMessages = (params) => {
			calls.push(params.channel);
			return listMessages(params);
		};
		const channels = space.channels.value() ?? [];
		let found = false;
		for (const channel of channels) {
			const threads = store.threadsOf(channel.space);
			await until(() => !!threads.value());
			if ((threads.value() ?? []).length > 0) {
				found = true;
				expect(store.threadsOf(channel.space)).toBe(threads);
				break;
			}
		}
		expect(found).toBe(true);
		expect(calls).toEqual([]);
	});
});
