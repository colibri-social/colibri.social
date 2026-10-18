import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
});

const mount = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", `/app/c/${HQ}`);
	const store = createDataStore(createMockSource({ live: false }));
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
	await expect.poll(() => location.pathname).toContain("channel.text");
	return store;
};

const inboxButton = () =>
	page.getByRole("button", { name: "Inbox", exact: true });

it("opens the inbox as a popover by default", async () => {
	await mount();
	const channelPath = location.pathname;
	await userEvent.click(inboxButton());
	await expect
		.poll(() => document.querySelector("[data-inbox-popover]"))
		.not.toBeNull();
	expect(document.querySelector("[data-inbox-modal]")).toBeNull();
	expect(location.pathname).toBe(channelPath);
});

it("opens the inbox in a large modal when the setting says so", async () => {
	const store = await mount();
	const channelPath = location.pathname;
	await store.preferences.setClient({ inboxPresentation: "modal" });
	expect(store.preferences.client().inboxPresentation).toBe("modal");

	await userEvent.click(inboxButton());
	await expect.poll(() => location.pathname).toBe("/app/inbox");
	await expect
		.poll(() => document.querySelector("[data-inbox-modal]"))
		.not.toBeNull();
	const modal = document.querySelector<HTMLElement>("[data-inbox-modal]");
	if (!modal) throw new Error("inbox modal missing");
	expect(modal.getAttribute("role")).toBe("dialog");
	expect(modal.querySelector('nav[aria-label="Inbox views"]')).not.toBeNull();
	expect(document.querySelector("[data-inbox-popover]")).toBeNull();
	expect(modal.getBoundingClientRect().width).toBeGreaterThan(900);
	await expect
		.poll(() => modal.querySelectorAll("[data-inbox-row]").length)
		.toBeGreaterThan(0);

	await userEvent.keyboard("{Escape}");
	await expect.poll(() => location.pathname).toBe(channelPath);
});
