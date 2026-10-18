import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	DEV_PATH,
	main,
	mount,
	rightClick,
	send,
	springCard,
	until,
	wait,
} from "./desktop-test-kit";

const header = () =>
	document.querySelector("[data-outlet='header']") as HTMLElement;

const membersToggle = () =>
	header().querySelector("button[aria-pressed][aria-label$='members']");

const cardButton = (card: HTMLElement) =>
	(card.matches("button") ? card : card.querySelector("button")) ?? card;

const shiftClick = (element: HTMLElement) =>
	element.dispatchEvent(
		new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			shiftKey: true,
		}),
	);

const pressLeft = (element: Element) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		cancelable: true,
		button: 0,
		clientX: box.left + Math.min(40, box.width / 2),
		clientY: box.top + Math.min(8, box.height / 2),
	};
	element.dispatchEvent(
		new PointerEvent("pointerdown", { ...init, pointerType: "mouse" }),
	);
	element.dispatchEvent(new MouseEvent("mousedown", init));
	element.dispatchEvent(
		new PointerEvent("pointerup", { ...init, pointerType: "mouse" }),
	);
	element.dispatchEvent(new MouseEvent("mouseup", init));
	element.dispatchEvent(new MouseEvent("click", init));
};

const openOverlay = async () => {
	await userEvent.click(
		Array.from(header().querySelectorAll("label")).find((label) =>
			label.textContent?.startsWith("Threads"),
		) as HTMLElement,
	);
	const row = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[data-threads-overlay] [data-thread-list] button",
			),
		).find((button) => button.textContent?.includes("Spring tuning"));
	await until(() => !!row());
	return row() as HTMLElement;
};

it("opens a thread card in the split pane, and in the full view with Shift", async () => {
	await mount();
	const chatList = main().querySelector("[data-message-list]");
	(cardButton(await springCard()) as HTMLElement).click();
	await until(
		() =>
			document
				.querySelector("[data-shell-thread] [data-thread-view]")
				?.getAttribute("data-presentation") === "split",
	);
	expect(membersToggle()).toBeNull();
	const pane = document.querySelector("[data-shell-thread]") as HTMLElement;
	await userEvent.click(
		pane.querySelector("button[aria-label='Close thread']") as HTMLElement,
	);
	await until(() => !document.querySelector("[data-shell-thread]"));
	shiftClick(cardButton(await springCard()) as HTMLElement);
	await until(() => !!document.querySelector("[data-thread-full]"));
	expect(location.pathname).toMatch(/\/t\/[^/]+\/full$/);
	await until(
		() => header().querySelector("h1")?.textContent === "Spring tuning",
	);
	expect(document.querySelector("[data-shell-thread]")).toBeNull();
	expect(header().querySelector("h1")?.textContent).toBe("Spring tuning");
	expect(header().querySelectorAll("[data-channel-header]")).toHaveLength(1);
	expect(membersToggle()).not.toBeNull();
	const back = header().querySelector<HTMLElement>(
		"button[aria-label='Back to #dev']",
	) as HTMLElement;
	await userEvent.click(back);
	await until(() => !document.querySelector("[data-thread-full]"));
	expect(location.pathname).toBe(DEV_PATH);
	expect(header().querySelector("h1")?.textContent).toBe("dev");
	expect(main().querySelector("[data-message-list]")).toBe(chatList);
});

it("opens threads from the overlay in the full view, and in the pane with Shift", async () => {
	await mount();
	await userEvent.click(await openOverlay());
	await until(() => !!document.querySelector("[data-thread-full]"));
	expect(document.querySelector("[data-threads-overlay]")).toBeNull();
	await userEvent.click(
		header().querySelector("button[aria-label='Back to #dev']") as HTMLElement,
	);
	await until(() => !document.querySelector("[data-thread-full]"));
	shiftClick(await openOverlay());
	await until(
		() =>
			document
				.querySelector("[data-shell-thread] [data-thread-view]")
				?.getAttribute("data-presentation") === "split",
	);
	expect(document.querySelector("[data-thread-full]")).toBeNull();
});

it("expands the split pane into the full view", async () => {
	await mount();
	(cardButton(await springCard()) as HTMLElement).click();
	await until(() => !!document.querySelector("[data-shell-thread]"));
	await userEvent.click(
		document.querySelector(
			"[data-shell-thread] button[aria-label='Expand thread']",
		) as HTMLElement,
	);
	await until(() => !!document.querySelector("[data-thread-full]"));
	expect(document.querySelector("[data-shell-thread]")).toBeNull();
	expect(location.pathname).toMatch(/\/full$/);
});

it("opens a thread created from a draft in the split pane", async () => {
	await mount();
	const article = await send("Draft starter");
	rightClick(article);
	const item = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>("[role='menuitem']"),
		).find((entry) => entry.textContent?.includes("Open thread"));
	await until(() => !!item());
	await userEvent.click(item() as HTMLElement);
	await until(
		() =>
			!!document.querySelector("[data-shell-thread] [data-thread-draft-view]"),
	);
	const editor = document.querySelector<HTMLElement>(
		"[data-shell-thread] [contenteditable='true']",
	) as HTMLElement;
	await userEvent.click(editor);
	await userEvent.keyboard("First words{Enter}");
	await until(
		() =>
			document
				.querySelector("[data-shell-thread] [data-thread-view]")
				?.getAttribute("data-presentation") === "split",
		10000,
	);
	expect(document.querySelector("[data-thread-full]")).toBeNull();
});

it("closes a message menu on a press on the same message without acting on it", async () => {
	await mount();
	const article = await send("Menu target");
	rightClick(article);
	await until(() => !!document.querySelector("[role='menu']"));
	pressLeft(article.querySelector("[data-message-content]") ?? article);
	await until(() => !document.querySelector("[role='menu']"));
	await wait(200);
	expect(document.querySelector("[role='menu']")).toBeNull();
	rightClick(await springCard());
	await until(
		() =>
			document.querySelector("[role='menu']")?.getAttribute("aria-label") ===
			"Spring tuning options",
	);
	pressLeft(cardButton(await springCard()) as HTMLElement);
	await until(() => !document.querySelector("[role='menu']"));
	await wait(300);
	expect(document.querySelector("[data-shell-thread]")).toBeNull();
	expect(document.querySelector("[data-thread-full]")).toBeNull();
});
