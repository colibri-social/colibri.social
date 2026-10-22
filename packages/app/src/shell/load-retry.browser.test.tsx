import "../app.css";
import { createMemoryKvStore, type KvStore } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMessageCache } from "../data/message-cache";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../data/store";
import type { SpaceRef } from "../data/types";
import { Providers } from "../providers";
import { usePlatform } from "../screen/platform";
import { MobileShell } from "./MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const NAMESPACE = "app:did:plc:viewer";
const HEADING = "This channel didn't load";

const stores: DataStore[] = [];
let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	for (const store of stores.splice(0)) store.dispose();
	localStorage.removeItem("colibri:last-space");
	localStorage.removeItem(`colibri:last-channel:${HQ}`);
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

type Source = ReturnType<typeof createMockSource>;

const generalOf = async (store: DataStore) => {
	await until(() => !!store.communities.value());
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("HQ missing");
	const space = store.space(hq);
	await until(() => !!space.channels.value());
	const general = space.channelBySlug("general");
	if (!general) throw new Error("general missing");
	return general.space;
};

const warmCache = async (kv: KvStore) => {
	const cache = createMessageCache({ namespace: NAMESPACE, kv });
	const store = createDataStore(createMockSource({ live: false }), { cache });
	stores.push(store);
	const feed = store.channel(await generalOf(store));
	await until(() => feed.ready() && feed.confirmed());
	await cache.flush();
	store.dispose();
};

type Outage = { down: boolean; failed: number };

const failMessages = (source: Source, outage: Outage) => {
	const original = source.listMessages;
	source.listMessages = (params) => {
		if (outage.down) {
			outage.failed += 1;
			return Promise.reject(new TypeError("Failed to fetch"));
		}
		return original(params);
	};
};

const holdMessages = (source: Source) => {
	const original = source.listMessages;
	const waiting: (() => void)[] = [];
	let held = false;
	source.listMessages = (params) => {
		if (!held) return original(params);
		return new Promise((resolve, reject) => {
			waiting.push(() => original(params).then(resolve, reject));
		});
	};
	return {
		hold: () => {
			held = true;
		},
		release: () => {
			held = false;
			for (const resume of waiting.splice(0)) resume();
		},
	};
};

const mount = async (
	options: { kv?: KvStore; prepare?: (source: Source) => void } = {},
) => {
	setLatency(0);
	await page.viewport(402, 874);
	const platform = usePlatform();
	await until(() => platform() === "mobile");
	const source = createMockSource({ live: false });
	options.prepare?.(source);
	const cache = options.kv
		? createMessageCache({ namespace: NAMESPACE, kv: options.kv })
		: undefined;
	const probe = createDataStore(createMockSource({ live: false }));
	stores.push(probe);
	const ref: SpaceRef = await generalOf(probe);
	const slug = ref.slice(ref.lastIndexOf("/") + 1);
	history.replaceState(null, "", `/app/c/${HQ}/${TEXT}/${slug}`);
	const store = createDataStore(source, cache ? { cache } : {});
	stores.push(store);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { store, ref };
};

const retryButton = () => page.getByRole("button", { name: "Try again" });

describe("retrying a channel that didn't load", () => {
	it("recovers without an app reload when cached messages were painted first", async () => {
		const kv = createMemoryKvStore();
		await warmCache(kv);
		const outage = { down: true, failed: 0 };
		const { store, ref } = await mount({
			kv,
			prepare: (source) => failMessages(source, outage),
		});
		await expect
			.element(page.getByRole("heading", { name: HEADING }))
			.toBeVisible();
		expect(store.channel(ref).ready()).toBe(true);
		outage.down = false;
		await userEvent.click(retryButton());
		await expect
			.poll(() => document.body.textContent ?? "")
			.not.toContain(HEADING);
		expect(store.channel(ref).loadError()).toBeUndefined();
	});

	it("keeps the error on screen with a spinner until the attempt settles", async () => {
		const outage = { down: true, failed: 0 };
		let gate: ReturnType<typeof holdMessages> | undefined;
		const { store, ref } = await mount({
			prepare: (source) => {
				failMessages(source, outage);
				gate = holdMessages(source);
			},
		});
		await expect
			.element(page.getByRole("heading", { name: HEADING }))
			.toBeVisible();
		outage.down = false;
		gate?.hold();
		await userEvent.click(retryButton());
		await expect.element(retryButton()).toHaveAttribute("aria-busy", "true");
		await expect
			.element(page.getByRole("heading", { name: HEADING }))
			.toBeVisible();
		gate?.release();
		await expect
			.poll(() => document.body.textContent ?? "")
			.not.toContain(HEADING);
		await until(() => store.channel(ref).ready());
	});

	it("shows the error again with a working retry when the second attempt fails too", async () => {
		const outage = { down: true, failed: 0 };
		const { store, ref } = await mount({
			prepare: (source) => failMessages(source, outage),
		});
		await expect
			.element(page.getByRole("heading", { name: HEADING }))
			.toBeVisible();
		const before = outage.failed;
		await userEvent.click(retryButton());
		await until(() => outage.failed > before);
		await expect
			.element(page.getByRole("heading", { name: HEADING }))
			.toBeVisible();
		await expect.element(retryButton()).not.toHaveAttribute("aria-busy");
		outage.down = false;
		await userEvent.click(retryButton());
		await expect
			.poll(() => document.body.textContent ?? "")
			.not.toContain(HEADING);
		await until(() => store.channel(ref).ready());
	});
});
