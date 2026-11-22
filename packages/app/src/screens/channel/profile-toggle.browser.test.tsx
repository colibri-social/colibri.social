import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanupMounted, main, mount, until, wait } from "./desktop-test-kit";

let restoreFocus: (() => void) | undefined;

afterEach(() => {
	restoreFocus?.();
	restoreFocus = undefined;
	cleanupMounted();
});

const lastOf = (selector: string) =>
	Array.from(main().querySelectorAll<HTMLElement>(selector)).at(-1);

const authorAvatar = () => {
	const button = lastOf(
		'article[data-message-key] button[aria-label$="\'s profile"]:not([data-chip-button])',
	);
	if (!button) throw new Error("missing author avatar");
	return button;
};

const authorName = () => {
	const button = lastOf("article[data-message-key] button[data-author-name]");
	if (!button) throw new Error("missing author name");
	return button;
};

const popoverOpen = () => !!document.querySelector("[data-profile-popover]");

const focusArticleOnPress = () => {
	const onMouseDown = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const article = target.closest<HTMLElement>("article[data-message-key]");
		if (!article || !target.closest("button")) return;
		event.preventDefault();
		article.focus();
	};
	window.addEventListener("mousedown", onMouseDown, true);
	restoreFocus = () =>
		window.removeEventListener("mousedown", onMouseDown, true);
};

const expectToggle = async (trigger: () => HTMLElement) => {
	await userEvent.click(trigger());
	await until(popoverOpen);
	await wait(300);

	await userEvent.click(trigger());
	await until(() => !popoverOpen());
	await wait(300);
	expect(popoverOpen()).toBe(false);
};

it("closes the profile popover when the author avatar is clicked again", async () => {
	await mount();
	await expectToggle(authorAvatar);
});

it("closes the profile popover when the author name is clicked again", async () => {
	await mount();
	await expectToggle(authorName);
});

it("closes on the second avatar click when the press focuses the message", async () => {
	await mount();
	focusArticleOnPress();
	await expectToggle(authorAvatar);
});

it("closes on the second name click when the press focuses the message", async () => {
	await mount();
	focusArticleOnPress();
	await expectToggle(authorName);
});
