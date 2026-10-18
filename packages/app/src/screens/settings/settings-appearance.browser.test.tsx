import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { ThemeSync } from "../../shell/theme-sync";
import {
	type SettingsNav,
	SettingsNavContext,
	type SettingsPageId,
} from "./nav";
import SettingsScreen from "./settings.screen";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
	document.documentElement.dataset.theme = "dark";
	localStorage.removeItem("colibri:theme");
});

const mount = async (page_?: SettingsPageId) => {
	setLatency(0);
	await page.viewport(402, 874);
	const store = createDataStore(createMockSource({ live: false }));
	const nav: SettingsNav = { open: vi.fn(), back: vi.fn() };
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<SettingsNavContext.Provider value={nav}>
						<ThemeSync />
						<SettingsScreen args={{ page: page_ }} />
					</SettingsNavContext.Provider>
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { store, nav };
};

it("lists the settings index on mobile and opens pages", async () => {
	const { nav, store } = await mount();
	await expect
		.element(page.getByRole("button", { name: "Appearance" }))
		.toBeVisible();
	expect(document.body.textContent).not.toContain("Accessibility");
	expect(document.body.textContent).not.toContain("Debug information");
	await userEvent.click(page.getByRole("button", { name: "Chat" }));
	expect(nav.open).toHaveBeenCalledWith("chat");
	store.setControls({ developerMode: true });
	await expect
		.element(page.getByRole("button", { name: "Logs" }))
		.toBeVisible();
});

it("toggles message previews and applies the theme on Appearance", async () => {
	const { store } = await mount("appearance");
	const toggle = page.getByRole("switch", { name: /Show message previews/ });
	await expect.element(toggle).toBeChecked();
	await userEvent.click(page.getByText("Show message previews"));
	await expect.poll(() => store.controls().showMessagePreviews).toBe(false);
	await userEvent.click(page.getByText("Light", { exact: true }));
	await expect.poll(() => document.documentElement.dataset.theme).toBe("light");
	expect(store.preferences.client().theme).toBe("light");
	expect(localStorage.getItem("colibri:theme")).toBe("light");
});

it("sets a Space-independent notification level", async () => {
	const { store } = await mount("notifications");
	await userEvent.click(page.getByText("Nothing", { exact: true }));
	await expect
		.poll(() => store.preferences.notificationLevel())
		.toBe("nothing");
});

it("syncs chat options and gestures", async () => {
	const { store } = await mount("chat");
	await userEvent.click(page.getByText("Warn me before I leave Colibri"));
	await expect
		.poll(() => store.preferences.client().warnOnExternalLinks)
		.toBe(false);
	await userEvent.click(page.getByText("Double tap a message"));
	await expect.poll(() => store.controls().doubleTapEnabled).toBe(true);
});
