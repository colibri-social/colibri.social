import "../../app.css";
import { render } from "solid-js/web";
import { afterEach } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

export const HQ = "did:plc:colibrihqspace2a4b6c8d";
export const TEXT = "social.colibri.beta.channel.text";
export const DEV_PATH = `/app/c/${HQ}/${TEXT}/dev`;

export const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

export const wait = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

let dispose: (() => void) | undefined;

export const cleanupMounted = () => {
	dispose?.();
	dispose = undefined;
};

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

export const mount = async (path = DEV_PATH) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
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
	await until(
		() =>
			document.querySelectorAll("[data-shell-main] article[data-message-key]")
				.length > 3,
	);
	await wait(200);
	return { store, source };
};

export const main = () =>
	document.querySelector("[data-shell-main]") as HTMLElement;

export const articleWithText = (root: ParentNode, text: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>("article[data-message-key]"),
	).find((article) => article.textContent?.includes(text));

export const mainEditor = () =>
	main().querySelector<HTMLElement>('[contenteditable="true"]') as HTMLElement;

export const send = async (text: string) => {
	await userEvent.click(mainEditor());
	await userEvent.keyboard(text);
	await userEvent.keyboard("{Enter}");
	await until(() => !!articleWithText(main(), text));
	await wait(150);
	return articleWithText(main(), text) as HTMLElement;
};

export const rightClick = (element: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + Math.min(120, rect.width / 2),
			clientY: rect.top + Math.min(10, rect.height / 2),
		}),
	);
};

export const menuItem = (label: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']")).find(
		(entry) => entry.textContent?.includes(label),
	);

export const springCard = async (name = "Spring tuning") => {
	const card = () =>
		Array.from(main().querySelectorAll<HTMLElement>("[data-thread]")).find(
			(element) => element.textContent?.includes(name),
		);
	const scroller = main().querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;
	const started = performance.now();
	while (!card()) {
		if (performance.now() - started > 8000) throw new Error("Card not found");
		scroller.scrollTop = Math.max(0, scroller.scrollTop - 600);
		await wait(80);
	}
	card()?.scrollIntoView({ block: "center" });
	await wait(300);
	return card() as HTMLElement;
};
