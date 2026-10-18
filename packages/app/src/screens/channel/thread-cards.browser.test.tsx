import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { ThreadView } from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import {
	articleWithText,
	DEV_PATH,
	main,
	rightClick,
	send,
	springCard,
	until,
	wait,
} from "./desktop-test-kit";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
});

const listShaped = ({ anchorMessage: _anchor, ...rest }: ThreadView) =>
	rest as ThreadView;

const mountListShaped = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", DEV_PATH);
	const source = createMockSource({ live: false });
	const listThreads = source.listThreads;
	const createThread = source.createThread;
	source.listThreads = async (channel) =>
		(await listThreads(channel)).map(listShaped);
	source.createThread = async (input) => listShaped(await createThread(input));
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
};

it("shows thread cards for threads listed without an anchor message", async () => {
	await mountListShaped();
	const card = await springCard();
	expect(card.textContent).toContain("Spring tuning");
});

it("shows the card of a newly created thread at once", async () => {
	await mountListShaped();
	const article = await send("Card starter");
	rightClick(article);
	const item = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>("[role='menuitem']"),
		).find((entry) => entry.textContent?.includes("Open thread"));
	await until(() => !!item());
	await userEvent.click(item() as HTMLElement);
	await until(
		() =>
			!!document.querySelector("[data-shell-thread] [data-thread-draft-view]"),
	);
	const editor = document.querySelector<HTMLElement>(
		"[data-shell-thread] [contenteditable='true']",
	) as HTMLElement;
	await userEvent.click(editor);
	await userEvent.keyboard("First words{Enter}");
	await until(
		() =>
			!!articleWithText(main(), "Card starter")?.querySelector("[data-thread]"),
		10000,
	);
});
