import type { KvStore } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { Providers } from "../providers";
import { MobileShell } from "../shell/MobileShell";
import { createMessageCache } from "./message-cache";
import { createMockSource, setLatency } from "./mock/source";
import { createSpaceCache } from "./space-cache";
import { createDataStore, DataContext, type DataStore } from "./store";

const NAMESPACE = "app:did:plc:viewer";
const SLOW = 60_000;
const SKELETON =
	"[data-skeleton],[data-skeleton-group],[data-skeleton-text],[data-session-loading]";

const memoryKv = (): KvStore => {
	const data = new Map<string, Map<string, unknown>>();
	const store = (name: string) => {
		let entries = data.get(name);
		if (!entries) {
			entries = new Map();
			data.set(name, entries);
		}
		return entries;
	};
	return {
		enabled: () => true,
		get: async <T,>(name: string, key: string) =>
			structuredClone(store(name).get(key)) as T | undefined,
		put: async (name, key, value) => {
			store(name).set(key, structuredClone(value));
		},
		remove: async (name, key) => {
			store(name).delete(key);
		},
		removeWhere: async (name, match) => {
			for (const key of [...store(name).keys()])
				if (match(key)) store(name).delete(key);
		},
		clear: async (names) => {
			for (const name of names) store(name).clear();
		},
		evictOldest: async () => {},
		close: () => {},
	};
};

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const frames = async (count: number) => {
	for (let index = 0; index < count; index++)
		await new Promise((resolve) => requestAnimationFrame(resolve));
};

const buttonStarting = (root: HTMLElement, name: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("button")).find((element) =>
		(element.getAttribute("aria-label") ?? element.textContent ?? "")
			.trim()
			.startsWith(name),
	);

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;
const stores: DataStore[] = [];
let originalPath = "/";

afterEach(() => {
	dispose?.();
	dispose = undefined;
	host?.remove();
	host = undefined;
	for (const store of stores.splice(0)) store.dispose();
	setLatency(0);
	history.replaceState(null, "", originalPath);
});

const warmUp = async (kv: KvStore) => {
	setLatency(0);
	const spaces = createSpaceCache({ namespace: NAMESPACE, kv });
	const cache = createMessageCache({ namespace: NAMESPACE, kv });
	const store = createDataStore(createMockSource({ live: false }), {
		cache,
		spaces,
	});
	stores.push(store);
	await until(() => (store.communities.value()?.length ?? 0) > 1);
	const list = store.communities.value() ?? [];
	for (const community of list) {
		const data = store.space(community);
		await until(
			() =>
				data.channels.value() !== undefined &&
				data.categories.value() !== undefined,
		);
	}
	const first = list[0];
	if (!first) throw new Error("no Spaces");
	const general = store
		.space(first)
		.channels.value()
		?.find((channel) => channel.name === "general");
	if (!general) throw new Error("no general channel");
	const feed = store.channel(general.space);
	await until(() => feed.ready() && feed.messages().length > 0);
	await spaces.flush();
	await cache.flush();
	return { names: list.map((community) => community.name), general };
};

const startOffline = async (kv: KvStore) => {
	setLatency(SLOW);
	const spaces = createSpaceCache({ namespace: NAMESPACE, kv });
	await spaces.load();
	const store = createDataStore(createMockSource({ live: false }), {
		cache: createMessageCache({ namespace: NAMESPACE, kv }),
		spaces,
	});
	stores.push(store);
	originalPath = location.pathname + location.search;
	history.replaceState(null, "", "/");
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const root = host;
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		root,
	);
	return { store, root };
};

it("starts from the last known Spaces without waiting for the network", async () => {
	const kv = memoryKv();
	const { names } = await warmUp(kv);
	const { store, root } = await startOffline(kv);
	expect(store.communities.loading()).toBe(false);
	expect(store.communities.value()?.map((entry) => entry.name)).toEqual(names);
	await until(() => !!root.querySelector("[data-space-rail]"), 3000);
	await frames(2);
	expect(root.querySelector(SKELETON)).toBeNull();
	expect(store.bootReady()).toBe(true);
});

it("switches Spaces and opens a cached channel while the network is silent", async () => {
	const kv = memoryKv();
	const { names } = await warmUp(kv);
	const { root } = await startOffline(kv);
	const [first, second] = names as [string, string];
	await until(() => !!buttonStarting(root, second));
	buttonStarting(root, second)?.click();
	await frames(3);
	expect(root.querySelector(SKELETON)).toBeNull();
	await until(() => !!buttonStarting(root, first));
	buttonStarting(root, first)?.click();
	await until(() => !!buttonStarting(root, "general"));
	buttonStarting(root, "general")?.click();
	await until(() => root.querySelectorAll("[data-message]").length > 0, 3000);
	const pane = root.querySelector<HTMLElement>('[data-pane-index="1"]');
	const stray = Array.from(pane?.querySelectorAll(SKELETON) ?? []).filter(
		(element) =>
			!element.closest("[data-message-list-skeleton], [data-media-tile]"),
	);
	expect(stray).toEqual([]);
});

it("keeps cached content in place while the network refresh lands", async () => {
	const kv = memoryKv();
	await warmUp(kv);
	setLatency(30);
	const spaces = createSpaceCache({ namespace: NAMESPACE, kv });
	await spaces.load();
	const base = createMockSource({ live: false });
	let fetched = false;
	const store = createDataStore(
		{
			...base,
			listCommunities: () =>
				base.listCommunities().then((list) => {
					fetched = true;
					return list;
				}),
		},
		{ spaces },
	);
	stores.push(store);
	const seen: boolean[] = [store.communities.loading()];
	const before = store.communities.value();
	expect(before?.length).toBeGreaterThan(0);
	await until(() => fetched);
	await new Promise((resolve) => setTimeout(resolve, 0));
	seen.push(store.communities.loading());
	expect(seen).toEqual([false, false]);
	expect(store.communities.value()?.map((entry) => entry.did)).toEqual(
		before?.map((entry) => entry.did),
	);
});

it("forgets a Space that was left", async () => {
	const kv = memoryKv();
	await warmUp(kv);
	setLatency(0);
	const spaces = createSpaceCache({ namespace: NAMESPACE, kv });
	const snapshot = await spaces.load();
	const left = snapshot?.communities?.[0]?.did;
	if (!left) throw new Error("no cached Space");
	spaces.forgetCommunity(left);
	await spaces.flush();
	const next = await createSpaceCache({ namespace: NAMESPACE, kv }).load();
	expect(next?.communities?.some((entry) => entry.did === left)).toBe(false);
	expect(next?.spaces[left]).toBeUndefined();
});
