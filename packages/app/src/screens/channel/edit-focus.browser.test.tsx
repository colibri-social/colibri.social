import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	main,
	menuItem,
	mount,
	rightClick,
	send,
	until,
	wait,
} from "./desktop-test-kit";

const composer = () =>
	main().querySelector<HTMLElement>(
		"[data-composer] [contenteditable='true']",
	) as HTMLElement;

const sendForKey = async (text: string) =>
	(await send(text)).getAttribute("data-message-key") as string;

const articleOf = (key: string) =>
	main().querySelector<HTMLElement>(
		`article[data-message-key="${CSS.escape(key)}"]`,
	);

const inlineEditor = (key: string) =>
	articleOf(key)?.querySelector<HTMLElement>(
		"[data-message-editor] [contenteditable='true']",
	);

const focusedIn = (element: HTMLElement | null | undefined) =>
	!!element?.contains(document.activeElement);

const startEdit = async (key: string) => {
	await until(() => !document.querySelector("[role='menu']"));
	rightClick(articleOf(key) as HTMLElement);
	await until(() => !!menuItem("Edit message"));
	await userEvent.click(menuItem("Edit message") as HTMLElement);
	await until(() => !!inlineEditor(key));
};

it("focuses a new inline edit right after saving another one", async () => {
	await mount();
	const first = await sendForKey("First draft");
	const second = await sendForKey("Second draft");
	await startEdit(first);
	await until(() => focusedIn(inlineEditor(first)));
	await userEvent.keyboard(" fixed{Enter}");
	await until(() => !inlineEditor(first));
	await startEdit(second);
	await until(() => focusedIn(inlineEditor(second)));
	await wait(400);
	expect(focusedIn(inlineEditor(second))).toBe(true);
	expect(focusedIn(composer())).toBe(false);
});

it("moves focus back into the open editor when the same message is edited again", async () => {
	await mount();
	const key = await sendForKey("Edit me twice");
	await startEdit(key);
	await until(() => focusedIn(inlineEditor(key)));
	await userEvent.click(composer());
	await until(() => focusedIn(composer()));
	await userEvent.keyboard("{ArrowUp}");
	await until(() => focusedIn(inlineEditor(key)));
	await wait(200);
	expect(focusedIn(inlineEditor(key))).toBe(true);
});

it("keeps the composer focused after a save when no new edit starts", async () => {
	await mount();
	const key = await sendForKey("Save and return");
	await startEdit(key);
	await until(() => focusedIn(inlineEditor(key)));
	await userEvent.keyboard(" again{Enter}");
	await until(() => !inlineEditor(key));
	await until(() => focusedIn(composer()));
});
