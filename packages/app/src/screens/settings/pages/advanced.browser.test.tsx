import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import AdvancedPage from "./advanced";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

it("syncs developer mode and hides options nothing can act on yet", async () => {
	const { store } = await mountPage(() => <AdvancedPage platform="mobile" />);
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
