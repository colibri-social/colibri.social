import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	articleWithText,
	cleanupMounted,
	main,
	mount,
	TEXT,
	until,
	wait,
} from "./desktop-test-kit";

const TRAIL = "did:plc:trailheadsclub4i6j8k2m";

afterEach(() => {
	cleanupMounted();
});

const headed = (text: string) => {
	const article = articleWithText(main(), text);
	if (!article) throw new Error(`missing message "${text}"`);
	return article;
};

it("keeps bridged authors out of the profile popover", async () => {
	await mount(`/app/c/${TRAIL}/${TEXT}/matrix`);
	const article = headed("Hey from the Matrix side!");
	const name = article.querySelector<HTMLElement>("[data-author-name]");
	if (!name) throw new Error("missing author name");

	expect(name.tagName).toBe("SPAN");
	expect(getComputedStyle(name).cursor).not.toBe("pointer");
	expect(article.querySelector("[data-member-menu]")).toBeNull();
	expect(
		article.querySelector('button[aria-label="Max\'s profile"]'),
	).toBeNull();
	expect(article.textContent).toContain("via Matrix");

	await userEvent.click(name);
	await wait(300);
	expect(document.querySelector("[data-profile-popover]")).toBeNull();
});

it("still opens the profile popover for members", async () => {
	await mount(`/app/c/${TRAIL}/${TEXT}/planning`);
	const article = Array.from(
		main().querySelectorAll<HTMLElement>("article[data-message-key]"),
	).find((row) => row.querySelector("button[data-author-name]"));
	if (!article) throw new Error("missing member message");
	const name = article.querySelector<HTMLElement>("button[data-author-name]");
	if (!name) throw new Error("missing author name");

	await userEvent.click(name);
	await until(() => !!document.querySelector("[data-profile-popover]"));
});
