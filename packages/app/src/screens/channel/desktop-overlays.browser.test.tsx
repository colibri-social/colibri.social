import { toast } from "@colibri-social/ui";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	articleWithText,
	cleanupMounted,
	DEV_PATH,
	HQ,
	main,
	menuItem,
	mount,
	rightClick,
	send,
	springCard,
	until,
	wait,
} from "./desktop-test-kit";

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
		(dialog) =>
			dialog.getAttribute("aria-label") === name ||
			dialog.querySelector("h2")?.textContent === name ||
			document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")
				?.textContent === name,
	);

const noMenu = () => until(() => !document.querySelector("[role='menu']"));

const fireDrag = (
	target: Element,
	type: "dragenter" | "dragover" | "dragleave" | "drop",
	dataTransfer: DataTransfer,
) => {
	const event = new DragEvent(type, {
		bubbles: true,
		cancelable: true,
		dataTransfer,
	});
	target.dispatchEvent(event);
	return event;
};

const files = () => {
	const transfer = new DataTransfer();
	transfer.items.add(
		new File(["notes"], "crow-notes.pdf", { type: "application/pdf" }),
	);
	return transfer;
};

const openThreadPane = async () => {
	const card = await springCard();
	(card.querySelector("button") ?? card).click();
	await until(
		() => !!document.querySelector("[data-shell-thread] [data-thread-view]"),
	);
	await wait(200);
};

it("forwards a message from a small modal", async () => {
	await mount();
	const article = await send("Forward this along");
	rightClick(article);
	await until(() => !!menuItem("Forward"));
	await userEvent.click(menuItem("Forward") as HTMLElement);
	await until(() => !!document.querySelector("[data-forward-modal]"));
	const dialog = dialogNamed("Forward message") as HTMLElement;
	expect(dialog).toBeTruthy();
	expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(362);
	const search = dialog.querySelector<HTMLInputElement>(
		"input[aria-label='Search channels']",
	) as HTMLInputElement;
	await userEvent.type(search, "general");
	const label = () =>
		Array.from(
			dialog.querySelectorAll<HTMLElement>("[data-forward-channel]"),
		).find((element) => element.textContent === "general");
	await until(() => !!label());
	await userEvent.click(label() as HTMLElement);
	const forward = Array.from(dialog.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === "Forward",
	) as HTMLButtonElement;
	await until(() => !forward.disabled);
	await userEvent.click(forward);
	await until(() => !document.querySelector("[data-forward-modal]"));
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
});

it("moves selected messages through the small destination modal with search", async () => {
	await mount();
	const article = await send("Move me somewhere");
	rightClick(article);
	await until(() => !!menuItem("Select messages"));
	await userEvent.click(menuItem("Select messages") as HTMLElement);
	await until(() => !!main().querySelector("[data-message-selection-bar]"));
	await noMenu();
	const move = Array.from(
		main().querySelectorAll<HTMLButtonElement>(
			"[data-message-selection-bar] button",
		),
	).find((button) => button.textContent?.includes("Move")) as HTMLButtonElement;
	await userEvent.click(move);
	await until(() => !!document.querySelector("[data-move-picker]"));
	const picker = document
		.querySelector("[data-move-picker]")
		?.closest("[role='dialog']") as HTMLElement;
	expect(picker.getBoundingClientRect().width).toBeLessThanOrEqual(362);
	const rows = () =>
		Array.from(picker.querySelectorAll<HTMLElement>("button")).map(
			(button) => button.textContent?.trim() ?? "",
		);
	await until(() => rows().some((text) => text.includes("Spring tuning")));
	expect(rows().some((text) => text.includes("New thread"))).toBe(true);
	await userEvent.type(
		picker.querySelector("input") as HTMLInputElement,
		"spring",
	);
	await until(() => !rows().some((text) => text === "general"));
	expect(rows().some((text) => text.includes("Spring tuning"))).toBe(true);
	const target = Array.from(
		picker.querySelectorAll<HTMLElement>("button"),
	).find((button) =>
		button.textContent?.includes("Spring tuning"),
	) as HTMLElement;
	await userEvent.click(target);
	await until(() => !document.querySelector("[data-move-picker]"));
	await until(
		() => !main().querySelector("[data-message-selection-bar]"),
		10000,
	);
});

it("opens the thread menu on right-click in chat and in the threads list", async () => {
	await mount();
	rightClick(await springCard());
	await until(() => !!menuItem("Rename thread"));
	const menus = document.querySelectorAll("[role='menu']");
	expect(menus).toHaveLength(1);
	expect(menus[0]?.getAttribute("aria-label")).toBe("Spring tuning options");
	await userEvent.click(menuItem("Rename thread") as HTMLElement);
	await until(() => !!document.querySelector("form[data-thread-rename]"));
	const form = document.querySelector(
		"form[data-thread-rename]",
	) as HTMLElement;
	expect(
		form.closest("[role='dialog']")?.getBoundingClientRect().width,
	).toBeLessThanOrEqual(362);
	const input = form.querySelector("input") as HTMLInputElement;
	await userEvent.clear(input);
	await userEvent.type(input, "Spring tuning notes");
	await userEvent.click(
		Array.from(form.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Rename",
		) as HTMLElement,
	);
	await until(() => !document.querySelector("form[data-thread-rename]"));
	await springCard("Spring tuning notes");
	await noMenu();
	const header = document.querySelector(
		"[data-outlet='header']",
	) as HTMLElement;
	await userEvent.click(
		Array.from(header.querySelectorAll("label")).find((label) =>
			label.textContent?.startsWith("Threads"),
		) as HTMLElement,
	);
	const row = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[data-threads-overlay] [data-thread-list] button",
			),
		).find((button) => button.textContent?.includes("Spring tuning notes"));
	await until(() => !!row());
	rightClick(row() as HTMLElement);
	await until(() => !!menuItem("Copy thread link"));
	expect(
		document.querySelector("[role='menu']")?.getAttribute("aria-label"),
	).toBe("Spring tuning notes options");
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
}, 30000);

it("has no thread options button in the desktop thread pane header", async () => {
	await mount();
	await openThreadPane();
	const pane = document.querySelector("[data-shell-thread]") as HTMLElement;
	expect(pane.querySelector("button[aria-label='Thread options']")).toBeNull();
	expect(
		pane.querySelector("button[aria-label='Close thread']"),
	).not.toBeNull();
});

it("shows custom emoji info in a popover anchored to the emoji", async () => {
	const { store } = await mount();
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const dev = community
		? store.space(community).channelBySlug("dev")
		: undefined;
	if (!dev) throw new Error("dev missing");
	await store
		.channel(dev.space)
		.send(store.emoji.withFacets(HQ, "ship :shipit:", []));
	const emoji = () =>
		main().querySelector<HTMLElement>("[data-custom-emoji-button]");
	await until(() => !!emoji());
	emoji()?.scrollIntoView({ block: "center" });
	await wait(200);
	await userEvent.click(emoji() as HTMLElement);
	await until(() => !!document.querySelector("[data-custom-emoji-drawer]"));
	const info = document.querySelector(
		"[data-custom-emoji-drawer]",
	) as HTMLElement;
	expect(info.dataset.platform).toBe("desktop");
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
	const box = info.closest("[role='dialog']")?.getBoundingClientRect();
	const anchor = (emoji() as HTMLElement).getBoundingClientRect();
	expect(box).toBeTruthy();
	expect(
		Math.abs(
			(box?.left ?? 0) +
				(box?.width ?? 0) / 2 -
				(anchor.left + anchor.width / 2),
		),
	).toBeLessThan((box?.width ?? 0) / 2 + 1);
	expect(info.textContent).toContain(":shipit:");
});

it("drops files into the composer of the zone they land in", async () => {
	await mount();
	await openThreadPane();
	const chatZone = main().querySelector(
		"[data-attachment-dropzone]",
	) as HTMLElement;
	const paneZone = document.querySelector(
		"[data-shell-thread] [data-attachment-dropzone]",
	) as HTMLElement;
	expect(chatZone).not.toBeNull();
	expect(paneZone).not.toBeNull();
	const overlayOf = (zone: HTMLElement) =>
		zone.querySelector("[data-attachment-dropzone-overlay]") as HTMLElement;
	const chatArea =
		chatZone.querySelector("[data-message-list-scroller]") ?? chatZone;
	const transfer = files();
	fireDrag(chatArea, "dragenter", transfer);
	expect(overlayOf(chatZone).hasAttribute("data-visible")).toBe(true);
	expect(overlayOf(paneZone).hasAttribute("data-visible")).toBe(false);
	fireDrag(chatArea, "dragover", transfer);
	fireDrag(chatArea, "drop", transfer);
	const trayOf = (zone: HTMLElement) =>
		zone.querySelector("[data-attachment-draft]");
	await until(() => !!trayOf(chatZone));
	expect(trayOf(paneZone)).toBeNull();
	const paneArea =
		paneZone.querySelector("[data-message-list-scroller]") ?? paneZone;
	const second = files();
	fireDrag(paneArea, "dragenter", second);
	expect(overlayOf(paneZone).hasAttribute("data-visible")).toBe(true);
	expect(overlayOf(chatZone).hasAttribute("data-visible")).toBe(false);
	fireDrag(paneArea, "drop", second);
	await until(() => !!trayOf(paneZone));
	expect(location.pathname.startsWith(DEV_PATH)).toBe(true);
	expect(articleWithText(main(), "crow-notes.pdf")).toBeUndefined();
});

const overlaps = (a: DOMRect, b: DOMRect) =>
	a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

it("keeps toasts above the composer and the selection bar", async () => {
	await mount();
	toast("Something happened");
	const toastBox = () =>
		document
			.querySelector<HTMLElement>("[data-toaster] li[data-toast]")
			?.getBoundingClientRect();
	await until(() => (toastBox()?.height ?? 0) > 0);
	await wait(300);
	const composer = main().querySelector("[data-chat-footer]") as HTMLElement;
	expect(
		overlaps(toastBox() as DOMRect, composer.getBoundingClientRect()),
	).toBe(false);
	expect((toastBox() as DOMRect).bottom).toBeLessThanOrEqual(
		composer.getBoundingClientRect().top,
	);
	const article = await send("Toast check");
	rightClick(article);
	await until(() => !!menuItem("Select messages"));
	await userEvent.click(menuItem("Select messages") as HTMLElement);
	await until(() => !!main().querySelector("[data-message-selection-bar]"));
	toast("Selection started");
	await wait(400);
	const move = Array.from(
		main().querySelectorAll<HTMLButtonElement>(
			"[data-message-selection-bar] button",
		),
	).find((button) => button.textContent?.includes("Move")) as HTMLButtonElement;
	for (const item of document.querySelectorAll<HTMLElement>(
		"[data-toaster] li[data-toast]",
	)) {
		expect(
			overlaps(item.getBoundingClientRect(), move.getBoundingClientRect()),
		).toBe(false);
	}
	expect(
		document.documentElement.style.getPropertyValue("--toast-bottom-offset"),
	).not.toBe("");
});

it("clears the toast offset when the desktop chat unmounts", async () => {
	await mount();
	await until(
		() =>
			document.documentElement.style.getPropertyValue(
				"--toast-bottom-offset",
			) !== "",
	);
	cleanupMounted();
	expect(
		document.documentElement.style.getPropertyValue("--toast-bottom-offset"),
	).toBe("");
});
