import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../../data/store";
import { openAppLink } from "../../native/deep-links";
import { Providers } from "../../providers";
import { usePlatform } from "../../screen/platform";
import { DesktopShell } from "./DesktopShell";

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

const mount = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	const platform = usePlatform();
	await until(() => platform() === "desktop");
	history.replaceState(null, "", `/app/c/${HQ}/${TEXT}/general`);
	const store = createDataStore(createMockSource({ live: false }));
	stores.push(store);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return store;
};

const composerFocused = () =>
	!!document.activeElement?.closest("[data-composer] [contenteditable]");

const writableChannel = (store: DataStore, except: string) => {
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	const channels = hq ? store.space(hq).channels.value() : undefined;
	const target = channels?.find(
		(channel) =>
			channel.type === TEXT &&
			channel.viewer.canPost !== false &&
			!channel.space.endsWith(`/${except}`),
	);
	if (!target) throw new Error("no second writable channel");
	return target.space.slice(target.space.lastIndexOf("/") + 1);
};

describe("desktop composer focus", () => {
	it("focuses the composer when the channel opens and when it changes", async () => {
		const store = await mount();
		await until(composerFocused);
		const next = writableChannel(store, "general");
		(document.activeElement as HTMLElement | null)?.blur();
		openAppLink(`https://spaces.colibri.social/app/c/${HQ}/${TEXT}/${next}`);
		await until(() => location.pathname.endsWith(`/${next}`));
		await until(composerFocused);
	});
});
