import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import ChatPage from "./chat";
import { cleanup, mountPage } from "./page-test-kit";

afterEach(cleanup);

it("syncs sharing what you're doing", async () => {
	const { store } = await mountPage(() => <ChatPage platform="mobile" />);
	const share = page.getByRole("switch", { name: /Share what I'm doing/ });
	const before = store.preferences.shareActivity();
	await expect.element(share).toHaveAttribute("aria-checked", String(before));
	await userEvent.click(page.getByText("Share what I'm doing"));
	await expect.poll(() => store.preferences.shareActivity()).toBe(!before);
});
