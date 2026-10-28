import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { DEVICE_KEYS } from "../../data/device-prefs";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { voice } from "../../data/voice";
import { Providers } from "../../providers";
import { DesktopShell } from "./DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	voice.leave();
	dispose?.();
	document.body.replaceChildren();
	localStorage.removeItem(DEVICE_KEYS.lastChannel(HQ));
	localStorage.removeItem(DEVICE_KEYS.lastSpace);
});

const mount = async (path: string) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", path);
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
	return store;
};

it("opens the last or first text channel of the Space", async () => {
	await mount(`/app/c/${HQ}`);
	await expect
		.poll(() => location.pathname)
		.toMatch(
			new RegExp(`^/app/c/${HQ}/social\\.colibri\\.beta\\.channel\\.text/`),
		);
	expect(document.querySelector("[data-app-shell]")).not.toBeNull();
});

it("reopens the voice stage after switching Spaces and back", async () => {
	const stagePath = `/app/c/${HQ}/social.colibri.beta.channel.voice/lounge`;
	await mount(stagePath);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
	await userEvent.click(
		page.getByRole("button", { name: /Night Owls/ }).first(),
	);
	await expect.poll(() => location.pathname).not.toContain(HQ);
	await userEvent.click(
		page.getByRole("button", { name: /Colibri HQ/ }).first(),
	);
	await expect.poll(() => location.pathname).toBe(stagePath);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
});

it("opens settings in a modal over the channel and closes back to it", async () => {
	await mount(`/app/c/${HQ}`);
	await expect.poll(() => location.pathname).toContain("channel.text");
	const channelPath = location.pathname;
	await userEvent.click(
		page
			.getByRole("region", { name: "Your account" })
			.getByRole("button", { name: /settings/i }),
	);
	await expect.poll(() => location.pathname).toBe("/app/settings");
	await expect.element(page.getByRole("dialog")).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => location.pathname).toBe(channelPath);
});

it("opens a deep-linked modal over the default channel", async () => {
	await mount(`/app/c/${HQ}/manage/roles`);
	await expect.element(page.getByRole("dialog")).toBeVisible();
	await expect
		.poll(() => !!document.activeElement?.closest("[role=dialog]"))
		.toBe(true);
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => location.pathname).toContain("channel.text");
});

it("keeps the modal mounted while it animates out", async () => {
	await mount(`/app/c/${HQ}`);
	await expect.poll(() => location.pathname).toContain("channel.text");
	await userEvent.click(
		page
			.getByRole("region", { name: "Your account" })
			.getByRole("button", { name: /settings/i }),
	);
	await expect.element(page.getByRole("dialog")).toBeVisible();
	await expect
		.poll(() => !!document.activeElement?.closest("[role=dialog]"))
		.toBe(true);
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => location.pathname).toContain("channel.text");
	const exiting = document.querySelector("[role=dialog]");
	expect(exiting).not.toBeNull();
	expect(exiting?.getAnimations().length).toBeGreaterThan(0);
	await expect.poll(() => document.querySelector("[role=dialog]")).toBeNull();
});

it("shows the presence state under the name until a status is set", async () => {
	const store = await mount(`/app/c/${HQ}`);
	await expect.poll(() => location.pathname).toContain("channel.text");
	const line = () =>
		document.querySelector("[data-user-panel] [data-user-panel-status]")
			?.textContent;
	const cleared = { text: "", emoji: "", removeCustomEmoji: true };
	await store.setStatus(cleared);
	await store.setOnlineState("dnd");
	await expect.poll(line).toBe("Do not disturb");
	await store.setOnlineState("away");
	await expect.poll(line).toBe("Away");
	await store.setStatus({ text: "Building a nest" });
	await expect.poll(line).toBe("Building a nest");
	await store.setStatus({ text: "", emoji: "🍜" });
	await expect.poll(line).toBe("🍜");
	await store.setStatus(cleared);
	await expect.poll(line).toBe("Away");
});
