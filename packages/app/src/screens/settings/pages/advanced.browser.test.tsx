import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type SettingsNav, SettingsNavContext } from "../nav";
import AdvancedPage from "./advanced";
import { cleanup, mountPage } from "./page-test-kit";

const updater = vi.hoisted(() => ({
	supported: undefined as unknown as () => boolean,
	setSupported: undefined as unknown as (value: boolean) => void,
	checkForUpdates: vi.fn(),
	restartToApply: vi.fn(),
}));

vi.mock("../../../native/updater", () => {
	const [supported, setSupported] = createSignal(false);
	updater.supported = supported;
	updater.setSupported = setSupported;
	return {
		updaterSupported: supported,
		updateState: () => ({ status: "ready", version: "0.18.3" }),
		checkForUpdates: updater.checkForUpdates,
		restartToApply: updater.restartToApply,
	};
});

vi.mock("@tauri-apps/api/app", () => ({
	getVersion: async () => "0.18.2",
}));

afterEach(() => {
	cleanup();
	updater.setSupported(false);
});

const mountAdvanced = () => {
	const nav: SettingsNav = { open: vi.fn(), back: vi.fn() };
	const mounted = mountPage(() => (
		<SettingsNavContext.Provider value={nav}>
			<AdvancedPage platform="mobile" />
		</SettingsNavContext.Provider>
	));
	return { nav, mounted };
};

it("syncs developer mode and hides options nothing can act on yet", async () => {
	const { mounted } = mountAdvanced();
	const { store } = await mounted;
	const developer = page.getByRole("switch", { name: /Developer mode/ });
	await expect.element(developer).not.toBeChecked();
	await userEvent.click(page.getByText("Developer mode"));
	await expect.poll(() => store.preferences.client().developerMode).toBe(true);
	await expect.element(developer).toBeChecked();

	await expect
		.element(page.getByText("Include my account in error reports"))
		.not.toBeInTheDocument();
	await expect
		.element(page.getByText("Use system window controls"))
		.not.toBeInTheDocument();
});

it("opens data deletion from the danger zone", async () => {
	const { nav, mounted } = mountAdvanced();
	await mounted;
	await expect.element(page.getByText("Danger zone")).toBeVisible();
	await userEvent.click(
		page.getByRole("button", { name: "Delete my Colibri data" }),
	);
	expect(nav.open).toHaveBeenCalledWith("deleteAccount");
});

it("hides updates where the build can't update itself", async () => {
	const { mounted } = mountAdvanced();
	await mounted;
	await expect.element(page.getByText("Developer mode")).toBeVisible();
	await expect
		.element(page.getByText("Updates", { exact: true }))
		.not.toBeInTheDocument();
});

it("shows the version and restarts into a downloaded update", async () => {
	updater.setSupported(true);
	const { mounted } = mountAdvanced();
	await mounted;
	await expect.element(page.getByText("Version 0.18.2")).toBeVisible();
	await expect
		.element(page.getByText("Version 0.18.3 is ready. Restart to finish."))
		.toBeVisible();
	await userEvent.click(
		page.getByRole("button", { name: "Restart to update" }),
	);
	expect(updater.restartToApply).toHaveBeenCalledOnce();
});
