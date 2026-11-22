import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const mount = async () => {
	setLatency(0);
	history.replaceState(null, "", DEV_PATH);
	const store = createDataStore(createMockSource({ live: false }));
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(
		() => !!host?.querySelector('[data-pane-index="1"] [data-message]'),
	);
	return host;
};

const pane = (root: HTMLElement, index: number) =>
	root.querySelector<HTMLElement>(`[data-pane-index="${index}"]`);

const buttonIn = (scope: ParentNode | null, name: string) =>
	Array.from(scope?.querySelectorAll<HTMLElement>("button") ?? []).find(
		(button) => button.getAttribute("aria-label") === name,
	);

it("opens members from the channel name and channel settings from there", async () => {
	const root = await mount();
	const chat = pane(root, 1);
	expect(buttonIn(chat, "Show members")).toBeUndefined();
	const trigger = buttonIn(chat, "dev, show members");
	expect(trigger).toBeDefined();
	trigger?.click();
	await until(() => !!buttonIn(pane(root, 2), "Channel settings"));
	buttonIn(pane(root, 2), "Channel settings")?.click();
	await until(() => location.pathname.endsWith("/manage/channel/dev"));
	await until(() => !!pane(root, 3));
});
