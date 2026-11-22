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

it("hides messages that moderators hid when the viewer turns them off", async () => {
	const { store } = await mountPage(() => <ChatPage platform="mobile" />);
	const toggle = page.getByRole("switch", { name: /Show hidden messages/ });
	await expect.element(toggle).toHaveAttribute("aria-checked", "true");
	await userEvent.click(page.getByText("Show hidden messages"));
	await expect
		.poll(() => store.preferences.client().hideModeratedMessages)
		.toBe(true);
	await expect.element(toggle).toHaveAttribute("aria-checked", "false");
});

it("syncs how many times GIFs play", async () => {
	const { store } = await mountPage(() => <ChatPage platform="desktop" />);
	const trigger = page.getByRole("button", { name: /Play GIFs in chat/ });
	await expect.element(trigger).toHaveTextContent("Keep playing");
	await userEvent.click(trigger);
	await userEvent.click(page.getByRole("option", { name: "Play once" }));
	await expect.poll(() => store.preferences.client().gifLoopLimit).toBe(1);
	await userEvent.click(trigger);
	await userEvent.click(page.getByRole("option", { name: "Keep playing" }));
	await expect
		.poll(() => store.preferences.client().gifLoopLimit)
		.toBeUndefined();
});
