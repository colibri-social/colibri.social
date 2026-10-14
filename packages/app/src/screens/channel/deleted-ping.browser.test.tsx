import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { SpaceRef } from "../../data/types";
import { setVoiceSoundPlayer } from "../../data/voice";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { DELETED_PING_COPY } from "./conversation";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const channelButton = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-channel-row]"))
		.find(
			(row) => row.querySelector("[data-channel-name]")?.textContent === name,
		)
		?.querySelector<HTMLElement>("a, button") ?? undefined;

const banner = () =>
	document.querySelector<HTMLElement>('[data-composer-bar="deleted-ping"]');

it("shows a banner when the pinged message no longer exists", async () => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	await page.viewport(402, 874);
	await until(() => !matchMedia("(min-width: 768px)").matches);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
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
	await until(() => !!channelButton("welcome"));
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const welcome = community
		? store
				.space(community)
				.channels.value()
				?.find((entry) => entry.name === "welcome")
		: undefined;
	expect(welcome).toBeDefined();
	store.jumps.request({
		channel: welcome?.space as SpaceRef,
		rkey: "2zzzzzzzzzzzz",
	});
	channelButton("welcome")?.click();
	await until(() => banner()?.dataset.open !== undefined);
	expect(banner()?.textContent).toContain(DELETED_PING_COPY);
	(banner()?.querySelector("button") as HTMLButtonElement).click();
	await until(() => banner()?.dataset.open === undefined);
});
