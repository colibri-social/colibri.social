import "../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import { Providers } from "../providers";
import { MobileShell } from "./MobileShell";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Nav = { currentEntry: { index: number } };
const nav = () => (globalThis as unknown as { navigation: Nav }).navigation;

let dispose: (() => void) | undefined;
let host: HTMLElement | undefined;

afterEach(() => {
	dispose?.();
	host?.remove();
	dispose = undefined;
	host = undefined;
	history.replaceState(null, "", "/");
});

const mount = () => {
	setLatency(0);
	const store = createDataStore(createMockSource({ live: false }));
	host = document.createElement("div");
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
};

const tab = (label: string) => {
	const button = Array.from(
		document.querySelectorAll<HTMLElement>('nav[aria-label="Main"] button'),
	).find((element) => element.textContent?.trim().startsWith(label));
	if (!button) throw new Error(`missing ${label} tab`);
	return button;
};

it("returns to the Inbox when going back from Settings", async () => {
	history.pushState(null, "", "/app/inbox");
	const startIndex = nav().currentEntry.index;
	mount();
	await wait(1000);
	await userEvent.click(tab("Settings"));
	await wait(600);
	expect(window.location.pathname).toBe("/app/settings");
	expect(nav().currentEntry.index - startIndex).toBe(1);
	history.back();
	await wait(600);
	expect(window.location.pathname).toBe("/app/inbox");
	expect(nav().currentEntry.index - startIndex).toBe(0);
	expect(tab("Inbox").getAttribute("aria-current")).toBe("page");
});
