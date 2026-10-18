import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	cleanupMounted,
	main,
	menuItem,
	mount,
	rightClick,
	TEXT,
	until,
	wait,
} from "./desktop-test-kit";

const TRAIL = "did:plc:trailheadsclub4i6j8k2m";
const HQ = "did:plc:colibrihqspace2a4b6c8d";

afterEach(() => {
	cleanupMounted();
});

const memberArticle = () => {
	const article = Array.from(
		main().querySelectorAll<HTMLElement>("article[data-message-key]"),
	).find((row) => row.querySelector("button[data-author-name]"));
	if (!article) throw new Error("missing member message");
	return article;
};

const closeMenu = async () => {
	document.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
	);
	await until(() => !document.querySelector("[role='menu']"));
};

const expectMemberMenu = async () => {
	await until(() => !!menuItem("View profile"));
	expect(menuItem("Copy DID")).toBeTruthy();
	expect(menuItem("Reply")).toBeUndefined();
	await wait(300);
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
};

it("opens the member context menu on the author name and avatar", async () => {
	await mount(`/app/c/${TRAIL}/${TEXT}/planning`);
	const article = memberArticle();
	const name = article.querySelector<HTMLElement>("button[data-author-name]");
	const avatar = article.querySelector<HTMLElement>(
		'button[aria-label$="\'s profile"]',
	);
	if (!name || !avatar) throw new Error("missing author triggers");

	for (const trigger of [name, avatar]) {
		rightClick(trigger);
		await expectMemberMenu();
		await closeMenu();
	}
});

it("opens the member context menu on a mention chip", async () => {
	await mount(`/app/c/${TRAIL}/${TEXT}/planning`);
	await until(() =>
		Array.from(main().querySelectorAll<HTMLElement>("[data-chip-button]")).some(
			(chip) => chip.textContent?.includes("@Louis"),
		),
	);
	const chip = Array.from(
		main().querySelectorAll<HTMLElement>("[data-chip-button]"),
	).find((element) => element.textContent?.includes("@Louis")) as HTMLElement;
	expect(chip.hasAttribute("data-member-menu")).toBe(false);

	rightClick(chip);
	await expectMemberMenu();
	await closeMenu();
});

it("opens the member context menu on a role popover row", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/announcements`);
	const chip = page.getByRole("button", { name: "Show members of Testers" });
	await expect.element(chip).toBeVisible();
	await userEvent.click(chip);
	const popover = page.getByRole("dialog", { name: "Testers members" });
	await expect.element(popover).toBeVisible();
	const row = (popover.element() as HTMLElement).querySelector<HTMLElement>(
		"[data-member-row]",
	) as HTMLElement;

	rightClick(row);
	await expectMemberMenu();
	await expect.element(popover).toBeVisible();
});
