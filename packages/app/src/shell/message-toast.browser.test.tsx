import "../app.css";
import { clearToasts, setAppActive } from "@colibri-social/ui";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import type { NotificationView, SpaceRef } from "../data/types";
import { Providers } from "../providers";
import { MobileShell } from "./MobileShell";

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
	clearToasts();
	document.body.innerHTML = "";
});

const mount = () => {
	setLatency(0);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
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
	const hq = source.world.spaces.find((space) => space.seed.key === "hq");
	const text = hq?.channels.filter(
		(channel) => channel.view.type === "social.colibri.beta.channel.text",
	);
	const first = text?.[0]?.view;
	const second = text?.[1]?.view;
	if (!first || !second) throw new Error("HQ needs two text channels");
	return { source, store, first, second };
};

let counter = 0;

const notification = (
	channel: SpaceRef,
	overrides: Partial<NotificationView> = {},
): NotificationView => {
	counter += 1;
	const now = new Date().toISOString();
	return {
		id: `toast-test-${counter}`,
		kind: "message",
		author: {
			did: "did:plc:toastauthor",
			handle: "ada.test",
			displayName: "Ada Toast",
		},
		channel,
		community: HQ,
		indexedAt: now,
		message: {
			rkey: `m${counter}`,
			text: `Hello number ${counter}`,
			attachments: [],
			channel,
			author: { did: "did:plc:toastauthor", handle: "ada.test" },
			createdAt: now,
		},
		...overrides,
	} as unknown as NotificationView;
};

const toasts = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-message-toast]"));

it("shows a toast for a new message and opens the channel on tap", async () => {
	const { source, store, first } = mount();
	await until(() => !!store.communities.value());
	source.emit({
		$type: "notificationEvent",
		notification: notification(first.space),
	});
	await until(() => toasts().length === 1);
	const toast = toasts()[0];
	expect(toast).toHaveTextContent("Ada Toast");
	expect(toast).toHaveTextContent(`#${first.name}`);
	expect(toast).toHaveTextContent("Hello number");
	expect(
		toast.querySelector("[data-message-toast-location]")?.textContent,
	).toBe(`#${first.name}`);
	toast.click();
	await until(() => store.viewing() === first.space);
	await until(() => document.querySelectorAll("li[data-toast]").length === 0);
});

it("keeps at most one message toast and shows the newest", async () => {
	const { source, store, first, second } = mount();
	await until(() => !!store.communities.value());
	source.emit({
		$type: "notificationEvent",
		notification: notification(first.space),
	});
	await until(() => toasts().length === 1);
	const latest = notification(second.space);
	source.emit({ $type: "notificationEvent", notification: latest });
	await until(() => toasts()[0]?.textContent?.includes(`#${second.name}`));
	expect(toasts()).toHaveLength(1);
});

it("stays quiet for the viewer's own messages and the channel on screen", async () => {
	const { source, store, first, second } = mount();
	await until(() => !!store.communities.value());
	source.emit({
		$type: "notificationEvent",
		notification: notification(first.space, {
			author: {
				did: store.viewer.did,
				handle: store.viewer.handle,
			} as NotificationView["author"],
		}),
	});
	store.setViewing(second.space);
	source.emit({
		$type: "notificationEvent",
		notification: notification(second.space),
	});
	await wait(300);
	expect(toasts()).toHaveLength(0);
	store.setViewing(undefined);
});

it("dismisses the toast once its channel opens another way", async () => {
	const { source, store, first } = mount();
	await until(() => !!store.communities.value());
	source.emit({
		$type: "notificationEvent",
		notification: notification(first.space),
	});
	await until(() => toasts().length === 1);
	store.setViewing(first.space);
	await until(() => document.querySelectorAll("li[data-toast]").length === 0);
	store.setViewing(undefined);
});

it("stays quiet while the app is in the background", async () => {
	const { source, store, first } = mount();
	await until(() => !!store.communities.value());
	setAppActive(false);
	source.emit({
		$type: "notificationEvent",
		notification: notification(first.space, { kind: "mention" }),
	});
	await wait(300);
	setAppActive(undefined);
	expect(toasts()).toHaveLength(0);
});

it("shows the Space name when the message comes from another Space", async () => {
	const { source, store } = mount();
	await until(() => (store.communities.value()?.length ?? 0) > 1);
	const other = store.communities.value()?.find((space) => space.did !== HQ);
	if (!other) throw new Error("needs a second Space");
	const channel = store.space(other);
	await until(() => (channel.channels.value()?.length ?? 0) > 0);
	const target = channel.channels
		.value()
		?.find((entry) => entry.type === "social.colibri.beta.channel.text");
	if (!target) throw new Error("needs a text channel");
	source.emit({
		$type: "notificationEvent",
		notification: notification(target.space, { community: other.did }),
	});
	await until(() => toasts().length === 1);
	expect(
		toasts()[0].querySelector("[data-message-toast-location]")?.textContent,
	).toBe(`${other.name} · #${target.name}`);
});
