import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	main,
	mainEditor,
	menuItem,
	mount,
	rightClick,
	send,
	until,
} from "./desktop-test-kit";

const replyBar = () =>
	main().querySelector<HTMLElement>('[data-composer-bar="reply"]');

it("dismisses the reply on Escape and keeps the composer text", async () => {
	await mount();
	const target = await send("Reply escape target");
	rightClick(target);
	await until(() => !!menuItem("Reply"));
	await userEvent.click(menuItem("Reply") as HTMLElement);
	await until(() => replyBar()?.hasAttribute("data-open") === true);

	await userEvent.click(mainEditor());
	await userEvent.keyboard("Draft stays");
	await userEvent.keyboard("{Escape}");

	await until(() => replyBar()?.hasAttribute("data-open") === false);
	expect(mainEditor().textContent).toBe("Draft stays");
});
