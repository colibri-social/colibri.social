import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	cleanupMounted,
	main,
	menuItem,
	mount,
	rightClick,
	until,
	wait,
} from "./desktop-test-kit";

afterEach(() => {
	cleanupMounted();
	window.getSelection()?.removeAllRanges();
});

const messageText = () => {
	const text = main().querySelector<HTMLElement>(
		"article[data-message-key] [data-rich-text]",
	);
	if (!text) throw new Error("no message text");
	return text;
};

const firstTextNode = (element: HTMLElement) => {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node && (node.textContent?.trim().length ?? 0) < 4) {
		node = walker.nextNode();
	}
	if (!node) throw new Error("no text node");
	return node;
};

const selectStartOf = (element: HTMLElement) => {
	const range = document.createRange();
	const node = firstTextNode(element);
	const start =
		(node.textContent?.length ?? 0) -
		(node.textContent?.trimStart().length ?? 0);
	range.setStart(node, start);
	range.setEnd(node, start + 4);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	return selection?.toString() ?? "";
};

const secondaryPress = (element: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + Math.min(120, rect.width / 2),
			clientY: rect.top + Math.min(10, rect.height / 2),
		}),
	);
};

const copySelectionItem = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']")).find(
		(entry) => entry.textContent?.trim() === "Copy",
	);

const closeMenu = async () => {
	await userEvent.keyboard("{Escape}");
	await until(() => !menuItem("Reply"));
	await wait(100);
};

it("ignores and clears the word selection a right-click makes", async () => {
	await mount();
	const text = messageText();
	window.getSelection()?.removeAllRanges();
	secondaryPress(text);
	selectStartOf(text);
	rightClick(text);
	await until(() => !!menuItem("Reply"));
	expect(copySelectionItem()).toBeUndefined();
	expect(window.getSelection()?.isCollapsed ?? true).toBe(true);
	await closeMenu();
	expect(window.getSelection()?.isCollapsed ?? true).toBe(true);
});

it("offers copy for a selection made before the right-click", async () => {
	await mount();
	const text = messageText();
	const selected = selectStartOf(text);
	secondaryPress(text);
	rightClick(text);
	await until(() => !!menuItem("Reply"));
	expect(copySelectionItem()).toBeTruthy();
	await wait(100);
	expect(window.getSelection()?.toString()).toBe(selected);
});
