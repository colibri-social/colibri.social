import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", "/");
});

const mount = (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
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
	return host;
};

const unavailableIcon = (root: HTMLElement, name: string) =>
	root.querySelector(`[data-pane-index="1"] svg.solar-${name}-bold`);

it("shows the speaker icon for a voice channel that no longer exists", async () => {
	const root = mount(`/app/c/${HQ}/social.colibri.beta.channel.voice/gone`);
	await until(
		() =>
			!!root
				.querySelector('[data-pane-index="1"]')
				?.textContent?.includes("This channel doesn't exist anymore"),
	);
	expect(unavailableIcon(root, "volume-small")).not.toBeNull();
	expect(unavailableIcon(root, "chat-square-dots")).toBeNull();
});

it("keeps the chat icon for a text channel that no longer exists", async () => {
	const root = mount(`/app/c/${HQ}/social.colibri.beta.channel.text/gone`);
	await until(
		() =>
			!!root
				.querySelector('[data-pane-index="1"]')
				?.textContent?.includes("This channel doesn't exist anymore"),
	);
	expect(unavailableIcon(root, "chat-square-dots")).not.toBeNull();
	expect(unavailableIcon(root, "volume-small")).toBeNull();
});
