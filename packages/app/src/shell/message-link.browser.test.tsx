import "../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../data/store";
import { messageLinkUrl, openAppLink } from "../native/deep-links";
import { Providers } from "../providers";
import { usePlatform } from "../screen/platform";
import { MISSING_LINKED_MESSAGE_COPY } from "../screens/channel/conversation";
import { DesktopShell } from "./desktop/DesktopShell";
import { MobileShell } from "./MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";

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

const oldestGeneralMessage = async (store: DataStore) => {
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("HQ missing");
	const space = store.space(hq);
	await until(() => !!space.channels.value());
	const general = space.channelBySlug("general");
	if (!general) throw new Error("general missing");
	const feed = store.channel(general.space);
	await until(() => feed.ready());
	const rkey = feed.messages()[0]?.rkey;
	if (!rkey) throw new Error("no messages");
	const slug = general.space.slice(general.space.lastIndexOf("/") + 1);
	return { rkey, channel: slug };
};

const mount = async (desktop = false) => {
	setLatency(0);
	await page.viewport(desktop ? 1440 : 402, desktop ? 900 : 874);
	const platform = usePlatform();
	await until(() => (platform() === "desktop") === desktop);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
	stores.push(store);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	const Shell = desktop ? DesktopShell : MobileShell;
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<Shell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(() => !!store.communities.value());
	return store;
};

const highlighted = (rkey: string) =>
	document.querySelector<HTMLElement>(
		`[data-message-key="${rkey}"][data-highlight="jumped"]`,
	);

describe("message links", () => {
	it("opens the channel and highlights the linked message on mobile", async () => {
		const target = await oldestGeneralMessage(await mount());
		const link = messageLinkUrl({
			space: HQ,
			channel: target.channel,
			channelType: TEXT,
			rkey: target.rkey,
		});
		expect(openAppLink(link)).toBe(true);
		await until(() => !!highlighted(target.rkey));
		expect(location.pathname).toBe(`/app/c/${HQ}/${TEXT}/${target.channel}`);
	});

	it("jumps within the channel that is already open on desktop", async () => {
		const target = await oldestGeneralMessage(await mount(true));
		await expect.poll(() => location.pathname).toContain(TEXT);
		openAppLink(
			messageLinkUrl({
				space: HQ,
				channel: target.channel,
				channelType: TEXT,
				rkey: target.rkey,
			}),
		);
		await until(() => !!highlighted(target.rkey));
		const rows = document.querySelectorAll("[data-channel-view='desktop']");
		expect(rows).toHaveLength(1);
	});

	it("shows a toast and stays at the latest messages when the message is gone", async () => {
		const target = await oldestGeneralMessage(await mount());
		openAppLink(
			messageLinkUrl({
				space: HQ,
				channel: target.channel,
				channelType: TEXT,
				rkey: "2zzzzzzzzzzzz",
			}),
		);
		await expect
			.element(page.getByText(MISSING_LINKED_MESSAGE_COPY))
			.toBeVisible();
		expect(document.querySelector("[data-highlight='jumped']")).toBeNull();
		expect(
			document.querySelector('[data-composer-bar="deleted-ping"][data-open]'),
		).toBeNull();
	});
});
