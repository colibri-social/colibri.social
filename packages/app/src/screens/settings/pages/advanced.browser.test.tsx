import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type SettingsNav, SettingsNavContext } from "../nav";
import AdvancedPage from "./advanced";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

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
