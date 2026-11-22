import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { cleanup, mountPage } from "./page-test-kit";
import WhatsNewPage from "./whats-new";

afterEach(cleanup);

it("links the full release history", async () => {
	await mountPage(() => <WhatsNewPage platform="desktop" />, {
		width: 1200,
		height: 900,
	});
	await expect
		.element(page.getByText("Nothing here yet.", { exact: false }))
		.toBeVisible();
	const history = document.querySelector<HTMLAnchorElement>(
		'a[href*="github.com/colibri-social/colibri.social/releases"]',
	);
	expect(history).not.toBeNull();
});
