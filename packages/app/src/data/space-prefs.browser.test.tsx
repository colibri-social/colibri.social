import { afterEach, describe, expect, it } from "vitest";
import {
	createMockSource,
	type MockSourceOptions,
	setLatency,
} from "./mock/source";
import { spaceNotificationPrefs } from "./notifications";
import { createDataStore } from "./store";
import type { SpaceRef } from "./types";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const setup = async (options: MockSourceOptions = {}) => {
	setLatency(0);
	const source = createMockSource({ live: false, ...options });
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

describe("synced preferences in the store", () => {
	const SNAPSHOT = "colibri:preferences:test";

	afterEach(() => localStorage.removeItem(SNAPSHOT));

	it("round trips channel and Space mutes through the preference records", async () => {
		const { source, store, hq, space } = await setup();
		const general = space.channelBySlug("general");
		if (!general) throw new Error("general missing");

		store.setMuted(general.space, true);
		store.spaceNotifications.setMuted(hq.did, true);
		expect(store.isMuted(general.space)).toBe(true);
		await source.preferences.settled();

		expect(
			source.preferenceBackend.state().mutes.map((m) => m.subject),
		).toEqual([
			{ kind: "channel", channel: general.space },
			{ kind: "actor", did: hq.did },
		]);
		expect(source.preferenceBackend.records()).toHaveLength(2);

		store.setMuted(general.space, false);
		await source.preferences.settled();
		expect(store.isMuted(general.space)).toBe(false);
		expect(source.preferenceBackend.records()).toHaveLength(1);
		expect(store.spaceNotifications.isMuted(hq.did)).toBe(true);
	});

	it("syncs thread mutes as thread subjects", async () => {
		const { source, store, hq } = await setup();
		const thread =
			`at://${hq.did}/space/social.colibri.beta.channel.thread/t1` as SpaceRef;
		store.setMuted(thread, true);
		await source.preferences.settled();
		expect(store.isMuted(thread)).toBe(true);
		expect(
			source.preferenceBackend.state().mutes.map((m) => m.subject),
		).toEqual([{ kind: "thread", thread }]);
	});

	it("restores mutes and controls from the snapshot in a new store", async () => {
		const first = await setup({ preferencesSnapshotKey: SNAPSHOT });
		const general = first.space.channelBySlug("general");
		if (!general) throw new Error("general missing");
		first.store.setMuted(general.space, true);
		first.store.setControls({ developerMode: true });
		first.store.dispose();

		const source = createMockSource({
			live: false,
			preferencesSnapshotKey: SNAPSHOT,
		});
		const store = createDataStore(source);
		expect(store.isMuted(general.space)).toBe(true);
		expect(store.controls().developerMode).toBe(true);
		store.dispose();
	});

	it("orders Spaces by the synced order", async () => {
		const { source, store } = await setup();
		const list = store.communities.value() ?? [];
		if (list.length < 2) throw new Error("needs two Spaces");
		const reversed = list.map((entry) => entry.did).reverse();
		await source.preferences.setCommunityOrder(reversed);
		expect(store.communities.value()?.map((entry) => entry.did)).toEqual(
			reversed,
		);
	});

	it("puts Spaces missing from the synced order on top", async () => {
		const { source, store } = await setup();
		const list = store.communities.value() ?? [];
		const first = list[0];
		if (!first || list.length < 2) throw new Error("needs two Spaces");
		await source.preferences.setCommunityOrder([first.did]);
		expect(store.communities.value()?.at(-1)?.did).toBe(first.did);
		expect(store.communities.value()).toHaveLength(list.length);
		expect(source.preferences.communityOrder()).toEqual([first.did]);
	});

	it("falls back to the global notification level", async () => {
		const { source, store, hq } = await setup();
		expect(store.spaceNotifications.level(hq.did)).toBe("all");
		await source.preferences.setNotificationLevel("nothing");
		expect(store.spaceNotifications.level(hq.did)).toBe("nothing");
		store.spaceNotifications.setLevel(hq.did, "mentionsAndReplies");
		expect(store.spaceNotifications.level(hq.did)).toBe("mentionsAndReplies");
		await source.preferences.settled();
		expect(source.preferenceBackend.state().spaceLevels).toEqual({
			[hq.did]: "mentionsAndReplies",
		});

		store.spaceNotifications.setLevel(hq.did, undefined);
		expect(store.spaceNotifications.level(hq.did)).toBe("nothing");
		expect(store.spaceNotifications.ownLevel(hq.did)).toBeUndefined();
	});

	it("restores emoji usage from the synced composer state", async () => {
		const { source, store } = await setup();
		source.preferences.recordEmoji("🦜");
		await source.preferences.settled();
		expect(source.preferenceBackend.state().composer.emojiUsage).toMatchObject({
			"🦜": { count: 1 },
		});
		expect(store.preferences.composer().emojiUsage["🦜"]?.count).toBe(1);
	});
});
