import "../app.css";
import { render } from "solid-js/web";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import { Providers } from "../providers";
import { MobileShell } from "../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Nav = { currentEntry: { index: number; url: string } };
const nav = () => (globalThis as unknown as { navigation: Nav }).navigation;

const mount = async () => {
	setLatency(0);
	history.pushState(null, "", `/app/c/${HQ}`);
	const startIndex = nav().currentEntry.index;
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await wait(1200);
	return {
		host,
		offset: () => nav().currentEntry.index - startIndex,
		dispose: () => {
			stop();
			host.remove();
			history.replaceState(null, "", "/");
		},
	};
};

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 41,
		isPrimary: true,
		button: 0,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(700);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	await wait(500);
};

it("keeps history in step when channel settings opens from the channel drawer", async () => {
	const app = await mount();
	const row = Array.from(app.host.querySelectorAll<HTMLElement>("button")).find(
		(button) => button.textContent?.trim().startsWith("general"),
	) as HTMLElement;
	await hold(row);
	const edit = Array.from(
		document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
	).find((button) => button.textContent?.trim() === "Edit channel");
	expect(edit).toBeTruthy();
	await userEvent.click(edit as HTMLElement);
	await wait(1200);
	expect(location.pathname).toBe(`/app/c/${HQ}/manage/channel/general`);
	expect(app.offset()).toBe(1);
	history.back();
	await wait(1000);
	expect(location.pathname).toBe(`/app/c/${HQ}`);
	expect(app.offset()).toBe(0);
	app.dispose();
});
