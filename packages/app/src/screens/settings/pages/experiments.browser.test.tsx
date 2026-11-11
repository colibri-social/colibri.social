import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import ExperimentsPage from "./experiments";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

it("offers routing calls through the relay", async () => {
	await mountPage(() => <ExperimentsPage platform="mobile" />);
	await expect
		.element(page.getByText("Route calls through the relay", { exact: false }))
		.toBeVisible();
});
