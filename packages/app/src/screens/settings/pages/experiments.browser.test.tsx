import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import ExperimentsPage from "./experiments";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

it("shows the empty state while no experiment is offered", async () => {
	await mountPage(() => <ExperimentsPage platform="mobile" />);
	await expect
		.element(page.getByText("No experiments right now.", { exact: false }))
		.toBeVisible();
});
