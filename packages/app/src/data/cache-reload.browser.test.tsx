import "../app.css";
import { createMemoryKvStore, type KvStore } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { Providers } from "../providers";
import { DesktopShell } from "../shell/desktop/DesktopShell";
import { FULL_THREAD_SEGMENT } from "../shell/layers";
import { skeyOf } from "./ids";
import { createMessageCache } from "./message-cache";
import { createMockSource, setLatency } from "./mock/source";
import { createSpaceCache } from "./space-cache";
import { createDataStore, DataContext, type DataStore } from "./store";
import type { Did } from "./types";

const NAMESPACE = "app:did:plc:viewer";
const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;
const SILENT = 60_000;
const SKELETON =
	"[data-skeleton],[data-skeleton-group],[data-skeleton-text],[data-session-loading]";

const stores: DataStore[] = [];
let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	for (const store of stores.splice(0)) store.dispose();
	setLatency(0);
	history.replaceState(null, "", "/");
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const start = async (kv: KvStore, latency: number) => {
	setLatency(latency);
	const spaces = createSpaceCache({ namespace: NAMESPACE, kv });
	await spaces.load();
	const cache = createMessageCache({ namespace: NAMESPACE, kv });
	const store = createDataStore(createMockSource({ live: false }), {
		cache,
		spaces,
	});
	stores.push(store);
	return {
		store,
		flush: async () => {
			await spaces.flush();
			await cache.flush();
		},
	};
};

const hq = (store: DataStore) => {
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	if (!community) throw new Error("no HQ");
	return store.space(community);
};

describe("reload from the device cache", () => {
	it("paints emoji, previews and presence while the network is silent", async () => {
		const kv = createMemoryKvStore();
		const warm = await start(kv, 0);
		await until(() => !!warm.store.communities.value()?.length);
		const space = hq(warm.store);
		const library = warm.store.emoji.library();
		const catalog = warm.store.emoji.catalog(HQ);
		await until(
			() =>
				!!library.value() &&
				!!catalog.value() &&
				!!space.members.value() &&
				!!space.channels
					.value()
					?.some((channel) => warm.store.lastMessage(channel.space)),
		);
		const online = space.members
			.value()
			?.find((member) => warm.store.presenceOf(member.actor.did));
		if (!online) throw new Error("no member with presence");
		const channel = space.channels
			.value()
			?.find((entry) => warm.store.lastMessage(entry.space));
		if (!channel) throw new Error("no channel preview");
		const preview = warm.store.lastMessage(channel.space)?.rkey;
		await warm.flush();

		const cold = await start(kv, SILENT);
		const coldSpace = hq(cold.store);
		expect(cold.store.emoji.library().value()?.own.community).toBe(
			library.value()?.own.community,
		);
		expect(cold.store.emoji.catalog(HQ).value()?.emojis.length).toBe(
			catalog.value()?.emojis.length,
		);
		expect(coldSpace.channels.loading()).toBe(false);
		expect(cold.store.lastMessage(channel.space)?.rkey).toBe(preview);
		expect(cold.store.presenceOf(online.actor.did)?.onlineState).toBe(
			warm.store.presenceOf(online.actor.did)?.onlineState,
		);
		expect(cold.store.presenceOf(online.actor.did)?.voice).toBeUndefined();
	});

	it("keeps read cursors for the next start", async () => {
		const kv = createMemoryKvStore();
		const warm = await start(kv, 0);
		await until(() => !!warm.store.communities.value()?.length);
		hq(warm.store);
		await new Promise((resolve) => setTimeout(resolve, 100));
		await warm.flush();
		const snapshot = await createSpaceCache({
			namespace: NAMESPACE,
			kv,
		}).load();
		expect(
			Object.keys(snapshot?.spaces[HQ]?.reads ?? {}).length,
		).toBeGreaterThan(0);
	});

	it("shows a full thread's members without skeletons", async () => {
		const kv = createMemoryKvStore();
		await page.viewport(1440, 900);
		const warm = await start(kv, 0);
		await until(() => !!warm.store.communities.value()?.length);
		const space = hq(warm.store);
		await until(() => !!space.channels.value());
		let path = "";
		for (const channel of space.channels.value() ?? []) {
			if (path || !channel.space.includes("channel.text")) continue;
			const threads = warm.store.channel(channel.space).threads;
			threads.value();
			await until(() => !threads.loading());
			const thread = threads.value()?.[0];
			if (!thread) continue;
			path = `/app/c/${HQ}/${channel.space.split("/").slice(4).join("/")}/t/${skeyOf(thread.space)}/${FULL_THREAD_SEGMENT}`;
		}
		if (!path) throw new Error("no thread");
		warm.store.dispose();

		const mount = async (latency: number) => {
			history.replaceState(null, "", path);
			const session = await start(kv, latency);
			const host = document.createElement("div");
			host.style.cssText = "position:fixed;inset:0";
			document.body.append(host);
			dispose = render(
				() => (
					<DataContext.Provider value={session.store}>
						<Providers>
							<DesktopShell />
						</Providers>
					</DataContext.Provider>
				),
				host,
			);
			return { ...session, host };
		};

		const opened = await mount(0);
		await until(() => !!opened.host.querySelector("[data-member-list]"));
		await opened.flush();
		dispose?.();
		document.body.replaceChildren();

		const reloaded = await mount(SILENT);
		await until(() => !!reloaded.host.querySelector("[data-shell-members]"));
		await new Promise((resolve) => setTimeout(resolve, 300));
		const members = reloaded.host.querySelector("[data-shell-members]");
		expect(members?.querySelector("[data-member-list]")).not.toBeNull();
		expect(members?.querySelector(SKELETON)).toBeNull();
	});
});
