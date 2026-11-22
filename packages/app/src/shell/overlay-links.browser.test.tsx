import "../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import { openAppLink } from "../native/deep-links";
import { Providers } from "../providers";
import { usePlatform } from "../screen/platform";
import { DesktopShell } from "./desktop/DesktopShell";
import { MobileShell } from "./MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const CHANNEL_PATH = `/app/c/${HQ}/${TEXT}/general`;

const LINKS = [
	["pack", "https://colibri.social/emoji/did:plc:packowner/starter"],
	["invite", "https://colibri.social/invite/abc123"],
	["createSpace", "https://colibri.social/app/new"],
] as const;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const mount = async (desktop: boolean) => {
	setLatency(0);
	await page.viewport(desktop ? 1440 : 402, desktop ? 900 : 874);
	const platform = usePlatform();
	await until(() => (platform() === "desktop") === desktop);
	history.replaceState(null, "", CHANNEL_PATH);
	const store = createDataStore(createMockSource({ live: false }));
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
	return host;
};

const channelNode = (host: HTMLElement, desktop: boolean) =>
	host.querySelector(
		desktop
			? "[data-channel-view='desktop']"
			: "[data-pane-index='1'] [data-keyboard-follow]",
	);

describe.each([
	["desktop", true],
	["mobile", false],
])("overlay links on %s", (_name, desktop) => {
	it.each(
		LINKS,
	)("keeps the channel screen when the %s link opens", async (_kind, link) => {
		const host = await mount(desktop);
		await until(() => !!channelNode(host, desktop));
		const before = channelNode(host, desktop);
		expect(openAppLink(link)).toBe(true);
		await expect.poll(() => location.pathname).not.toBe(CHANNEL_PATH);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(channelNode(host, desktop)).toBe(before);
		expect(before?.isConnected).toBe(true);
	});
});
