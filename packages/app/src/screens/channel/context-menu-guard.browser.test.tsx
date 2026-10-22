import { afterEach, expect, it } from "vitest";
import {
	cleanupMounted,
	main,
	mainEditor,
	mount,
	until,
} from "./desktop-test-kit";

afterEach(() => {
	cleanupMounted();
});

const scroller = () =>
	main().querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;

const rowAt = (x: number, y: number) =>
	document
		.elementFromPoint(x, y)
		?.closest<HTMLElement>("article[data-message-key]") ?? null;

const contextMenu = (target: Element, x: number, y: number) => {
	const event = new MouseEvent("contextmenu", {
		bubbles: true,
		cancelable: true,
		button: 2,
		clientX: x,
		clientY: y,
	});
	target.dispatchEvent(event);
	return event;
};

const openMenu = () => document.querySelector("[role='menu']");

const closeMenu = async () => {
	document.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
	);
	await until(() => !openMenu());
};

it("opens the menu for the message under the pointer after a scroll without a pointer move", async () => {
	await mount();
	const list = scroller();
	await until(() => list.scrollHeight > list.clientHeight * 2);
	const box = list.getBoundingClientRect();
	const x = box.left + box.width / 2;
	const samples = Array.from(
		{ length: 9 },
		(_, step) => box.top + (box.height * (step + 1)) / 10,
	).map((y) => ({
		y,
		stale: document.elementFromPoint(x, y),
		before: rowAt(x, y),
	}));

	list.scrollTop -= list.clientHeight * 0.75;
	await until(
		() =>
			samples.filter((sample) => !!rowAt(x, sample.y)).length >=
			samples.length / 2,
		4000,
	);
	const pick = samples.find((sample) => {
		const after = rowAt(x, sample.y);
		return (
			!!sample.stale &&
			!!after &&
			after.dataset.messageKey !== sample.before?.dataset.messageKey
		);
	});
	if (!pick?.stale)
		throw new Error("no point with a different message after scrolling");
	const after = rowAt(x, pick.y) as HTMLElement;

	const event = contextMenu(pick.stale, x, pick.y);
	expect(event.defaultPrevented).toBe(true);
	await until(() => !!openMenu());
	await until(
		() =>
			!!after.querySelector("[data-highlight='menu']") ||
			after.dataset.highlight === "menu",
	);
	if (pick.before && pick.before !== after)
		expect(pick.before.querySelector("[data-highlight='menu']")).toBeNull();
	expect(document.querySelectorAll("[role='menu']")).toHaveLength(1);
	await closeMenu();
});

it("keeps the native menu on empty app surfaces on the web", async () => {
	await mount();
	const shell = document.querySelector<HTMLElement>("[data-shell-main]");
	if (!shell) throw new Error("no shell");
	const box = shell.getBoundingClientRect();
	const event = contextMenu(document.body, box.left + 2, box.bottom - 2);
	expect(event.defaultPrevented).toBe(false);
});

it("keeps the native menu in the composer", async () => {
	await mount();
	const editor = mainEditor();
	const box = editor.getBoundingClientRect();
	const event = contextMenu(
		editor,
		box.left + box.width / 2,
		box.top + box.height / 2,
	);
	expect(event.defaultPrevented).toBe(false);
});
