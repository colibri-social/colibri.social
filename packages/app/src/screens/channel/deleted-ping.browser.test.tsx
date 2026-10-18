import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { CachedWindow, MessageCache } from "../../data/message-cache";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type {
	Datetime,
	MessageView,
	NotificationView,
	SpaceRef,
} from "../../data/types";
import { setVoiceSoundPlayer } from "../../data/voice";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { DELETED_PING_COPY } from "./conversation";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	setLatency(0);
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const channelButton = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-channel-row]"))
		.find(
			(row) => row.querySelector("[data-channel-name]")?.textContent === name,
		)
		?.querySelector<HTMLElement>("a, button") ?? undefined;

const banner = () =>
	document.querySelector<HTMLElement>('[data-composer-bar="deleted-ping"]');

it("shows a banner when the pinged message no longer exists", async () => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	await page.viewport(402, 874);
	await until(() => !matchMedia("(min-width: 768px)").matches);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
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
	await until(() => !!channelButton("welcome"));
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const welcome = community
		? store
				.space(community)
				.channels.value()
				?.find((entry) => entry.name === "welcome")
		: undefined;
	expect(welcome).toBeDefined();
	store.jumps.request({
		channel: welcome?.space as SpaceRef,
		rkey: "2zzzzzzzzzzzz",
	});
	channelButton("welcome")?.click();
	await until(() => banner()?.dataset.open !== undefined);
	expect(banner()?.textContent).toContain(DELETED_PING_COPY);
	(banner()?.querySelector("button") as HTMLButtonElement).click();
	await until(() => banner()?.dataset.open === undefined);
});

const staleCache = (space: SpaceRef, messages: MessageView[]): MessageCache => {
	const window: CachedWindow = {
		space,
		messages,
		hasMore: false,
		ts: Date.now(),
	};
	const recall = (ref: SpaceRef) => (ref === space ? window : undefined);
	return {
		recall,
		read: async (ref) => recall(ref),
		offer: () => {},
		forget: () => {},
		forgetCommunity: () => {},
		flush: async () => {},
		clear: async () => {},
	};
};

const pingFor = (
	message: MessageView,
	channel: SpaceRef,
	rkey = message.rkey,
): NotificationView => ({
	id: `mention:test:${rkey}`,
	kind: "mention",
	author: message.author,
	channel,
	community: HQ as NotificationView["community"],
	message: { ...message, rkey },
	indexedAt: new Date().toISOString() as Datetime,
});

const mountWelcome = async (
	build: (
		source: ReturnType<typeof createMockSource>,
		welcome: SpaceRef,
		messages: MessageView[],
	) => { cache?: MessageCache; ping: NotificationView },
) => {
	setVoiceSoundPlayer(() => {});
	await page.viewport(402, 874);
	await until(() => !matchMedia("(min-width: 768px)").matches);
	history.replaceState(null, "", `/app/c/${HQ}`);
	setLatency(0);
	const source = createMockSource({ live: false });
	const record = source.world.spaces
		.find((entry) => entry.did === HQ)
		?.channels.find((entry) => entry.view.name === "welcome");
	if (!record) throw new Error("Seed changed");
	const welcome = record.view.space;
	const messages = source.world.messagesOf(record);
	const { cache, ping } = build(source, welcome, messages);
	const store = createDataStore(source, cache ? { cache } : {});
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
	await until(() => !!channelButton("welcome"));
	await until(() => store.notifications.status() === "ready");
	source.emit({ $type: "notificationEvent", notification: ping });
	const seen = () =>
		store.notifications.items().find((entry) => entry.id === ping.id)?.seenAt;
	return { store, welcome, seen };
};

it("waits for the network before calling a cached ping deleted", async () => {
	const { store, welcome } = await mountWelcome(
		(_source, welcome, messages) => {
			const target = messages.at(-2) as MessageView;
			return {
				cache: staleCache(
					welcome,
					messages.filter((message) => message.rkey !== target.rkey),
				),
				ping: pingFor(target, welcome),
			};
		},
	);
	setLatency(400);
	channelButton("welcome")?.click();
	await until(() => store.channel(welcome).ready());
	expect(store.channel(welcome).confirmed()).toBe(false);
	await until(() => store.channel(welcome).confirmed());
	await new Promise((resolve) => setTimeout(resolve, 600));
	expect(banner()?.dataset.open).toBeUndefined();
});

it("confirms a missing ping before showing the banner and marking it read", async () => {
	const { seen } = await mountWelcome((_source, welcome, messages) => {
		const before = messages.at(-2) as MessageView;
		return { ping: pingFor(before, welcome, `${before.rkey}a`) };
	});
	channelButton("welcome")?.click();
	await until(() => banner()?.dataset.open !== undefined);
	expect(banner()?.textContent).toContain(DELETED_PING_COPY);
	await until(() => !!seen());
});
