import "../../../app.css";
import { render } from "solid-js/web";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = () => location.pathname.replace(`/app/c/${HQ}`, "") || "/";

it("opens Space settings from the Space menu and closes back to the list without a stale history entry", async () => {
	setLatency(0);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	render(
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
	const menu = Array.from(document.querySelectorAll("button")).find(
		(button) =>
			button.getAttribute("aria-label") === "Colibri HQ, Space options",
	) as HTMLElement;
	await userEvent.click(menu);
	await wait(700);
	const settings = Array.from(
		document.querySelectorAll('[role="dialog"] button'),
	).find((button) => button.textContent?.trim() === "Settings") as HTMLElement;
	await userEvent.click(settings);
	await wait(1200);
	expect(short()).toBe("/manage/overview");
	const close = host.querySelector(
		"[data-pane][data-pane-active] header button",
	) as HTMLElement;
	await userEvent.click(close);
	await wait(1000);
	expect(short()).toBe("/");
	expect(history.state).toEqual({ colibriDepth: 0 });
	history.replaceState(null, "", "/");
});
