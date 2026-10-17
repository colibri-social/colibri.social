import "../app.css";
import { clearToasts, setAppActive } from "@colibri-social/ui";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import type { ChannelView, NotificationView, SpaceRef } from "../data/types";
import { createDeviceNotifications } from "../native/notifications/device";
import type {
	OsActivation,
	OsNotification,
	OsNotifier,
	OsPermission,
} from "../native/notifications/index";
import { Providers } from "../providers";
import { NotificationHost } from "./NotificationHost";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 4000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	setAppActive(undefined);
	clearToasts();
	document.body.innerHTML = "";
});

const fakeNotifier = (permission: OsPermission = "granted") => {
	const shown: OsNotification[] = [];
	const dismissed: string[] = [];
	let cleared = 0;
	let activate: ((activation: OsActivation) => void) | undefined;
	const notifier: OsNotifier = {
		kind: "native",
		permission: async () => permission,
		requestPermission: async () => permission,
		show: async (notification) => {
			shown.push(notification);
		},
		dismiss: async (target) => {
			dismissed.push(target);
		},
		clearAll: async () => {
			cleared += 1;
		},
		onActivation: (handler) => {
			activate = handler;
			return () => {
				activate = undefined;
			};
		},
	};
	return {
		notifier,
		shown,
		dismissed,
		cleared: () => cleared,
		activate: (activation: OsActivation) => activate?.(activation),
	};
};

const mount = (
	options: { enabled?: boolean; permission?: OsPermission } = {},
) => {
	setLatency(0);
	if (options.permission === "default") {
		localStorage.removeItem("colibri:notification-prompt-answered");
	}
	if (options.enabled === false) {
		localStorage.setItem("colibri:native-notifications", "false");
	}
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	const os = fakeNotifier(options.permission);
	const play = vi.fn();
	const stack = {
		root: () => ({ tab: "inbox" as const }),
		setRoot: vi.fn(),
		push: vi.fn(),
	};
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<NotificationHost
						stack={stack}
						notifier={async () => os.notifier}
						device={createDeviceNotifications(async () => os.notifier)}
						play={play}
					/>
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	const hq = source.world.spaces.find((space) => space.seed.key === "hq");
	const channel = hq?.channels.find(
		(entry) => entry.view.type === "social.colibri.beta.channel.text",
	)?.view as ChannelView | undefined;
	if (!channel) throw new Error("HQ needs a text channel");
	return { source, store, os, play, stack, channel };
};

let counter = 0;

const notification = (
	channel: SpaceRef,
	overrides: Partial<NotificationView> = {},
): NotificationView => {
	counter += 1;
	const now = new Date().toISOString();
	return {
		id: `host-test-${counter}`,
		kind: "mention",
		author: {
			did: "did:plc:hostauthor",
			handle: "ada.test",
			displayName: "Ada Host",
		},
		channel,
		community: HQ,
		indexedAt: now,
		message: {
			rkey: `h${counter}`,
			text: `Ping number ${counter}`,
			attachments: [],
			channel,
			author: { did: "did:plc:hostauthor", handle: "ada.test" },
			createdAt: now,
		},
		...overrides,
	} as unknown as NotificationView;
};

const toasts = () => document.querySelectorAll("[data-message-toast]");

it("shows a toast and pings while the app is in front", async () => {
	const { source, store, os, play, channel } = mount();
	await until(() => !!store.communities.value());
	source.emit({
		$type: "notificationEvent",
		notification: notification(channel.space),
	});
	await until(() => toasts().length === 1);
	expect(play).toHaveBeenCalledWith("ping");
	expect(os.shown).toHaveLength(0);
});

it("posts an OS notification with its Space and channel while hidden", async () => {
	const { source, store, os, play, channel } = mount();
	await until(() => !!store.communities.value());
	await wait(50);
	setAppActive(false);
	source.emit({
		$type: "notificationEvent",
		notification: notification(channel.space),
	});
	await until(() => os.shown.length === 1);
	const hq = store.spaceByKey(HQ);
	expect(os.shown[0]).toMatchObject({
		title: "Ada Host",
		subtitle: `Mentioned you · ${hq?.name} › #${channel.name}`,
		channel: channel.space,
		authorDid: "did:plc:hostauthor",
	});
	expect(play).toHaveBeenCalledWith("ping");
	expect(toasts()).toHaveLength(0);
});

it("only pings while hidden when device notifications are off", async () => {
	const { source, store, os, play, channel } = mount({ enabled: false });
	await until(() => !!store.communities.value());
	await wait(50);
	setAppActive(false);
	source.emit({
		$type: "notificationEvent",
		notification: notification(channel.space),
	});
	await until(() => play.mock.calls.length === 1);
	await wait(100);
	expect(os.shown).toHaveLength(0);
});

it("stays silent in do not disturb", async () => {
	const { source, store, os, play, channel } = mount();
	await until(() => !!store.communities.value());
	await store.setOnlineState("dnd");
	setAppActive(false);
	source.emit({
		$type: "notificationEvent",
		notification: notification(channel.space),
	});
	await wait(200);
	expect(play).not.toHaveBeenCalled();
	expect(os.shown).toHaveLength(0);
});

it("opens the conversation when a notification is clicked", async () => {
	const { store, os, stack, channel } = mount();
	await until(() => !!store.communities.value());
	await wait(50);
	os.activate({ channel: channel.space, rkey: "h1" });
	expect(stack.setRoot).toHaveBeenCalledWith({ tab: "spaces", space: HQ });
	expect(stack.push).toHaveBeenCalledWith(
		expect.objectContaining({ kind: "chat", space: HQ }),
	);
});

it("dismisses the channel's notifications once it's on screen", async () => {
	const { store, os, channel } = mount();
	await until(() => !!store.communities.value());
	store.setViewing(channel.space);
	await until(() => os.dismissed.includes(channel.space));
	store.setViewing(undefined);
});

it("clears every OS notification when everything is marked read", async () => {
	const { source, store, os } = mount();
	await until(() => !!store.communities.value());
	source.emit({
		$type: "seenEvent",
		unread: 0,
		seenAt: new Date().toISOString(),
	} as never);
	await until(() => os.cleared() === 1);
});

it("asks once to turn notifications on and remembers a dismissal", async () => {
	const { store } = mount({ permission: "default" });
	await until(() => !!store.communities.value());
	await until(
		() => !!document.body.textContent?.includes("Turn on notifications?"),
	);
	const notNow = Array.from(document.querySelectorAll("button")).find(
		(button) => button.textContent === "Not now",
	);
	notNow?.click();
	await until(
		() => !document.body.textContent?.includes("Turn on notifications?"),
	);
	expect(localStorage.getItem("colibri:notification-prompt-answered")).toBe(
		"true",
	);
});
