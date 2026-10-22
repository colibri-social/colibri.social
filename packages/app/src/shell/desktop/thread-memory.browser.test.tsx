import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	DEV_PATH,
	HQ,
	main,
	mount,
	springCard,
	until,
} from "../../screens/channel/desktop-test-kit";

const cardButton = (card: HTMLElement) =>
	(card.matches("button") ? card : card.querySelector("button")) ?? card;

const splitThread = () =>
	document
		.querySelector("[data-shell-thread] [data-thread-view]")
		?.getAttribute("data-presentation") === "split";

const switchTo = async (name: RegExp) => {
	await userEvent.click(page.getByRole("button", { name }).first());
};

it("reopens the thread pane when you come back to a Space", async () => {
	await mount();
	(cardButton(await springCard()) as HTMLElement).click();
	await until(splitThread);
	const threadPath = location.pathname;
	expect(threadPath.startsWith(`${DEV_PATH}/t/`)).toBe(true);
	await switchTo(/Night Owls/);
	await until(() => !location.pathname.includes(HQ));
	await until(() => !document.querySelector("[data-shell-thread]"));
	await switchTo(/Colibri HQ/);
	await until(() => location.pathname === threadPath);
	await until(splitThread);
	expect(main().querySelector("[data-message-list]")).not.toBeNull();
});

it("leaves a closed thread closed when you come back to a Space", async () => {
	await mount();
	(cardButton(await springCard()) as HTMLElement).click();
	await until(splitThread);
	const pane = document.querySelector("[data-shell-thread]") as HTMLElement;
	await userEvent.click(
		pane.querySelector("button[aria-label='Close thread']") as HTMLElement,
	);
	await until(() => !document.querySelector("[data-shell-thread]"));
	await switchTo(/Night Owls/);
	await until(() => !location.pathname.includes(HQ));
	await switchTo(/Colibri HQ/);
	await until(() => location.pathname === DEV_PATH);
	expect(document.querySelector("[data-shell-thread]")).toBeNull();
});
