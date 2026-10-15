import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { DataStore } from "../../data/store";
import type { Did, SpaceRef } from "../../data/types";
import {
	HQ,
	main,
	menuItem,
	mount,
	rightClick,
	send,
	until,
	wait,
} from "./desktop-test-kit";

const devOf = (store: DataStore) => {
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const dev = community
		? store.space(community).channelBySlug("dev")
		: undefined;
	if (!community || !dev) throw new Error("dev missing");
	const other = store
		.space(community)
		.members.value()
		?.find((member) => member.actor.did !== store.viewer.did)?.actor.did;
	if (!other) throw new Error("no other member");
	return { channel: dev.space as SpaceRef, other: other as Did };
};

const scroller = () =>
	main().querySelector("[data-message-list-scroller]") as HTMLElement;

const lastArticle = () => {
	const articles = main().querySelectorAll<HTMLElement>(
		"article[data-message-key]",
	);
	return articles[articles.length - 1] as HTMLElement;
};

it("keeps the normal group gap between the last message and the typing row", async () => {
	await mount();
	await wait(400);
	const typing = main().querySelector("[data-composer-typing]") as HTMLElement;
	const gap =
		typing.getBoundingClientRect().top -
		lastArticle().getBoundingClientRect().bottom;
	expect(gap).toBeGreaterThanOrEqual(4);
	expect(gap).toBeLessThanOrEqual(12);
});

it("reserves the typing room inside the list and overlays the typing row on it", async () => {
	const { store, source } = await mount();
	const { channel, other } = devOf(store);
	await wait(400);
	const bottom = main().querySelector(
		"[data-message-list-bottom]",
	) as HTMLElement;
	const typing = () =>
		main().querySelector("[data-composer-typing]") as HTMLElement;
	const list = scroller();
	expect(Number.parseFloat(getComputedStyle(bottom).paddingBottom)).toBe(32);
	expect(getComputedStyle(typing()).position).toBe("absolute");
	expect(
		Math.abs(
			typing().getBoundingClientRect().bottom -
				list.getBoundingClientRect().bottom,
		),
	).toBeLessThanOrEqual(0.5);
	const fade = getComputedStyle(typing()).backgroundImage;
	expect(fade).toContain("rgb");
	expect(fade).not.toMatch(/oklab|oklch|color-mix/);
	const height = list.clientHeight;
	source.emit({ $type: "typingEvent", did: other, channel });
	await until(() => !!typing().querySelector("[data-active]"));
	await wait(300);
	expect(list.clientHeight).toBe(height);
	expect(Number.parseFloat(getComputedStyle(bottom).paddingBottom)).toBe(32);
	expect(
		list.scrollHeight - list.scrollTop - list.clientHeight,
	).toBeLessThanOrEqual(1);
	expect(lastArticle().getBoundingClientRect().bottom).toBeLessThanOrEqual(
		typing().getBoundingClientRect().top + 0.5,
	);
});

it("matches the composer to the user panel height and edges", async () => {
	await mount();
	const box = (
		main().querySelector("[data-composer-box]") as HTMLElement
	).getBoundingClientRect();
	const panel = (
		document.querySelector("[data-user-panel]") as HTMLElement
	).getBoundingClientRect();
	expect(Math.abs(box.top - panel.top)).toBeLessThanOrEqual(0.5);
	expect(Math.abs(box.bottom - panel.bottom)).toBeLessThanOrEqual(0.5);
	expect(Math.abs(box.height - panel.height)).toBeLessThanOrEqual(0.5);
});

it("centers the jump card above the composer and clear of the typing row", async () => {
	await mount();
	const list = scroller();
	list.dispatchEvent(new WheelEvent("wheel", { deltaY: -1500, bubbles: true }));
	list.scrollTop -= 1500;
	await until(
		() =>
			main()
				.querySelector("[data-message-list-jump]")
				?.hasAttribute("data-visible") ?? false,
	);
	await wait(300);
	const card = (
		main().querySelector("[data-jump-card]") as HTMLElement
	).getBoundingClientRect();
	const area = (
		main().querySelector("[data-message-list]") as HTMLElement
	).getBoundingClientRect();
	const typing = (
		main().querySelector("[data-composer-typing]") as HTMLElement
	).getBoundingClientRect();
	expect(
		Math.abs(card.left + card.width / 2 - (area.left + area.width / 2)),
	).toBeLessThanOrEqual(1);
	expect(card.bottom).toBeLessThanOrEqual(typing.top);
});

it("holds a small scroll up through live activity", async () => {
	const { store, source } = await mount();
	const { channel, other } = devOf(store);
	await wait(300);
	const list = scroller();
	list.dispatchEvent(new WheelEvent("wheel", { deltaY: -20, bubbles: true }));
	list.scrollTop -= 20;
	await wait(100);
	const before = list.scrollTop;
	source.emit({ $type: "typingEvent", did: other, channel });
	await wait(500);
	source.simulateMessage({ author: other, channel, text: "Live one" });
	await wait(700);
	source.simulateMessage({ author: other, channel, text: "Live two" });
	await wait(2500);
	expect(Math.abs(list.scrollTop - before)).toBeLessThanOrEqual(1);
	expect(
		list.scrollHeight - list.scrollTop - list.clientHeight,
	).toBeGreaterThan(20);
});

it("keeps both lists intact under the settings modal and after it closes", async () => {
	const { store, source } = await mount();
	const { channel, other } = devOf(store);
	await wait(400);
	const list = scroller();
	list.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, bubbles: true }));
	list.scrollTop -= 300;
	await wait(200);
	const members = () =>
		document.querySelector<HTMLElement>("[data-shell-members]") as HTMLElement;
	const membersScroller = () =>
		Array.from(members().querySelectorAll<HTMLElement>("*")).find(
			(element) => element.scrollHeight > element.clientHeight + 1,
		) as HTMLElement;
	membersScroller().scrollTop = 200;
	await wait(200);
	const firstArticle = main().querySelector("article[data-message-key]");
	const firstMember = members().querySelector("li");
	const chatTop = list.scrollTop;
	const memberTop = membersScroller().scrollTop;
	const count = main().querySelectorAll("article[data-message-key]").length;
	await userEvent.click(
		page.getByRole("button", { name: /settings/i }).first(),
	);
	await until(() => !!document.querySelector("[role='dialog']"));
	for (const ms of [50, 400, 1200]) {
		await wait(ms);
		expect(main().querySelector("article[data-message-key]")).toBe(
			firstArticle,
		);
		expect(main().querySelectorAll("article[data-message-key]").length).toBe(
			count,
		);
		expect(Math.abs(list.scrollTop - chatTop)).toBeLessThanOrEqual(1);
		expect(members().querySelector("li")).toBe(firstMember);
		expect(
			Math.abs(membersScroller().scrollTop - memberTop),
		).toBeLessThanOrEqual(1);
	}
	source.emit({ $type: "typingEvent", did: other, channel });
	source.simulateMessage({
		author: other,
		channel,
		text: "While settings open",
	});
	await wait(800);
	expect(Math.abs(list.scrollTop - chatTop)).toBeLessThanOrEqual(1);
	expect(main().querySelector("article[data-message-key]")).toBe(firstArticle);
	await userEvent.keyboard("{Escape}");
	await until(() => !document.querySelector("[role='dialog']"));
	await wait(600);
	expect(main().querySelector("article[data-message-key]")).toBe(firstArticle);
	expect(Math.abs(list.scrollTop - chatTop)).toBeLessThanOrEqual(1);
	expect(Math.abs(membersScroller().scrollTop - memberTop)).toBeLessThanOrEqual(
		1,
	);
});

it("hides the members toggle while a thread pane is open and restores the list after", async () => {
	await mount();
	const header = () =>
		document.querySelector("[data-outlet='header']") as HTMLElement;
	const toggle = () =>
		header().querySelector("button[aria-pressed][aria-label$='members']");
	await until(() => !!toggle());
	const wasOpen = !!document.querySelector("[data-shell-members]");
	const article = await send("Pane test");
	rightClick(article);
	await until(() => !!menuItem("Open thread"));
	await userEvent.click(menuItem("Open thread") as HTMLElement);
	await until(() => !!document.querySelector("[data-shell-thread]"));
	expect(toggle()).toBeNull();
	expect(document.querySelector("[data-shell-members]")).toBeNull();
	await userEvent.click(
		document.querySelector(
			"[data-shell-thread] button[aria-label='Discard thread']",
		) as HTMLElement,
	);
	await until(() => !document.querySelector("[data-shell-thread]"));
	await until(() => !!toggle());
	expect(!!document.querySelector("[data-shell-members]")).toBe(wasOpen);
});

it("swaps More actions for Delete while Shift is held and keeps the regular buttons in place", async () => {
	await mount();
	const article = await send("Shift delete me");
	await userEvent.hover(article);
	const bar = () =>
		article.querySelector<HTMLElement>("[role='toolbar']") as HTMLElement;
	await until(() => !!bar());
	const xOf = (action: string) =>
		Math.round(
			(
				bar().querySelector(`[data-toolbar-action='${action}']`) as HTMLElement
			).getBoundingClientRect().left,
		);
	const before = ["add-reaction", "edit", "forward"].map(xOf);
	window.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }),
	);
	await until(() => !!bar().querySelector("[data-toolbar-action='delete']"));
	expect(bar().querySelector("button[aria-label='More actions']")).toBeNull();
	expect(bar().querySelector("[data-toolbar-action='react']")).toBeNull();
	expect(["add-reaction", "edit", "forward"].map(xOf)).toEqual(before);
	(
		bar().querySelector("[data-toolbar-action='delete']") as HTMLElement
	).click();
	await until(
		() =>
			!article.isConnected || !main().textContent?.includes("Shift delete me"),
	);
	expect(
		document.querySelector("[role='alertdialog'], [role='dialog']"),
	).toBeNull();
	window.dispatchEvent(
		new KeyboardEvent("keyup", { key: "Shift", shiftKey: false }),
	);
});

it("asks before deleting from the right-click menu", async () => {
	await mount();
	const article = await send("Confirm delete me");
	rightClick(article);
	await until(() => !!menuItem("Delete message"));
	await userEvent.click(menuItem("Delete message") as HTMLElement);
	const confirm = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[role='alertdialog'], [role='dialog']",
			),
		).find((dialog) => dialog.textContent?.includes("Delete message?"));
	await until(() => !!confirm());
	expect(main().textContent).toContain("Confirm delete me");
	const button = Array.from(
		(confirm() as HTMLElement).querySelectorAll("button"),
	).find(
		(entry) => entry.textContent?.trim() === "Delete message",
	) as HTMLElement;
	await userEvent.click(button);
	await until(() => !main().textContent?.includes("Confirm delete me"));
});

it("fits the thread filters and fills the overlay with the list", async () => {
	await mount();
	const header = document.querySelector(
		"[data-outlet='header']",
	) as HTMLElement;
	await userEvent.click(
		Array.from(header.querySelectorAll("label")).find((label) =>
			label.textContent?.startsWith("Threads"),
		) as HTMLElement,
	);
	await until(
		() =>
			!!document.querySelector("[data-threads-overlay] [data-thread-list] li"),
	);
	const overlay = document.querySelector(
		"[data-threads-overlay]",
	) as HTMLElement;
	const filters = overlay.querySelector(
		"[role='radiogroup'][aria-label='Filter threads']",
	) as HTMLElement;
	for (const label of filters.querySelectorAll<HTMLElement>("label span")) {
		expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
	}
	const row = (
		overlay.querySelector("[data-thread-list] li") as HTMLElement
	).getBoundingClientRect();
	const box = overlay.getBoundingClientRect();
	expect(Math.round(row.left - box.left)).toBe(12);
	expect(Math.round(box.right - row.right)).toBe(12);
});
