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

it("keeps the Space list on the first app history entry so back goes to the device", async () => {
	setLatency(0);
	history.pushState(null, "", `/app/c/${HQ}`);
	const startIndex = nav().currentEntry.index;
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
	const log: string[] = [];
	const at = (label: string) =>
		log.push(`${label}: ${nav().currentEntry.index - startIndex}`);
	await wait(1200);
	at("start");
	const btn = (pred: (b: HTMLElement) => boolean) =>
		Array.from(document.querySelectorAll<HTMLElement>("button")).find(pred);
	const text = (b: HTMLElement) =>
		(b.getAttribute("aria-label") ?? b.textContent ?? "").trim();
	const click = async (label: string, el: HTMLElement | undefined) => {
		if (!el) {
			log.push(`missing ${label}`);
			return;
		}
		await userEvent.click(el);
	};
	await click(
		"general",
		btn((b) => text(b).startsWith("general")),
	);
	await wait(900);
	history.back();
	await wait(900);
	at("chat then back");
	await click(
		"menu",
		btn((b) => text(b) === "Colibri HQ, Space options"),
	);
	await wait(700);
	history.back();
	await wait(900);
	at("drawer then back");
	await click(
		"menu",
		btn((b) => text(b) === "Colibri HQ, Space options"),
	);
	await wait(700);
	await click(
		"settings",
		Array.from(
			document.querySelectorAll<HTMLElement>('[role="dialog"] button'),
		).find((b) => b.textContent?.trim() === "Settings"),
	);
	await wait(1200);
	history.back();
	await wait(900);
	at("settings then back");
	const rail = Array.from(
		document.querySelectorAll<HTMLElement>(
			"[data-space-rail] button, nav button",
		),
	).filter((b) => /Night Owls/.test(text(b)))[0];
	await click("rail", rail);
	await wait(900);
	at("switch space");
	history.replaceState(null, "", "/");
	expect(log).toEqual([
		"start: 0",
		"chat then back: 0",
		"drawer then back: 0",
		"settings then back: 0",
		"switch space: 0",
	]);
});
