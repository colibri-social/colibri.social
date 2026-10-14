import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	articleWithText,
	DEV_PATH,
	main,
	mainEditor,
	mount,
	send,
	until,
} from "./desktop-test-kit";

it("renders the desktop channel header in the shell header and toggles members", async () => {
	await mount();
	const header = document.querySelector<HTMLElement>(
		"[data-outlet='header'] [data-channel-header='desktop']",
	);
	expect(header).not.toBeNull();
	expect(header?.querySelector("h1")?.textContent).toBe("dev");
	expect(main().querySelector("[data-channel-header]")).toBeNull();
	const toggle = header?.querySelector<HTMLButtonElement>(
		"button[aria-pressed][aria-label$='members']",
	) as HTMLButtonElement;
	const open = () => !!document.querySelector("[data-shell-members]");
	const before = open();
	await userEvent.click(toggle);
	await until(() => open() !== before);
	await userEvent.click(toggle);
	await until(() => open() === before);
});

it("sends a message with Enter from the desktop composer", async () => {
	await mount();
	const article = await send("Hello from the desktop");
	expect(
		article.dataset.platform ?? article.getAttribute("data-platform"),
	).toBe("desktop");
	expect(mainEditor().textContent).toBe("");
});

it("renders the hover toolbar on sent messages and edits inline", async () => {
	await mount();
	const article = await send("Edit me please");
	const toolbar = article.querySelector<HTMLElement>(
		"[data-message-toolbar] [role='toolbar']",
	) as HTMLElement;
	expect(toolbar).not.toBeNull();
	const slot = toolbar.parentElement as HTMLElement;
	expect(getComputedStyle(slot).visibility).toBe("hidden");
	expect(slot.className).toContain("group-hover/message:visible");
	(
		toolbar.querySelector("[data-toolbar-action='edit']") as HTMLElement
	).click();
	await until(() => article.hasAttribute("data-editing"));
	const editor = article.querySelector<HTMLElement>(
		'[contenteditable="true"]',
	) as HTMLElement;
	await until(() => editor.contains(document.activeElement));
	await userEvent.keyboard(" now");
	await userEvent.keyboard("{Enter}");
	await until(() => !!articleWithText(main(), "Edit me please now"));
	await until(
		() =>
			!articleWithText(main(), "Edit me please now")?.hasAttribute(
				"data-editing",
			),
	);
});

it("opens the threads overlay, then a thread over the chat, and closes it", async () => {
	await mount();
	const header = () =>
		document.querySelector("[data-outlet='header']") as HTMLElement;
	const threadsLabel = Array.from(header().querySelectorAll("label")).find(
		(label) => label.textContent?.startsWith("Threads"),
	) as HTMLElement;
	await userEvent.click(threadsLabel);
	await until(() => !!document.querySelector("[data-threads-overlay]"));
	expect(location.pathname).toBe(`${DEV_PATH}/threads`);
	const row = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[data-threads-overlay] [data-thread-list] button",
			),
		).find((button) => button.textContent?.includes("Spring tuning"));
	await until(() => !!row());
	await userEvent.click(row() as HTMLElement);
	await until(() => !document.querySelector("[data-threads-overlay]"));
	await until(
		() => !!document.querySelector("[data-thread-full] [data-thread-view]"),
	);
	expect(location.pathname).toMatch(new RegExp(`^${DEV_PATH}/t/.+/full$`));
	const back = () =>
		header().querySelector<HTMLElement>("button[aria-label='Back to #dev']");
	await until(() => !!back());
	await userEvent.click(back() as HTMLElement);
	await until(() => !document.querySelector("[data-thread-full]"));
	expect(location.pathname).toBe(DEV_PATH);
});

it("selects messages from the right-click menu with Shift ranges", async () => {
	await mount();
	const first = await send("Select one");
	await send("Select two");
	const third = await send("Select three");
	first.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: first.getBoundingClientRect().left + 120,
			clientY: first.getBoundingClientRect().top + 10,
		}),
	);
	await until(
		() =>
			!!Array.from(document.querySelectorAll("[role='menuitem']")).find(
				(item) => item.textContent?.includes("Select messages"),
			),
	);
	const item = Array.from(
		document.querySelectorAll<HTMLElement>("[role='menuitem']"),
	).find((entry) =>
		entry.textContent?.includes("Select messages"),
	) as HTMLElement;
	await userEvent.click(item);
	await until(() => !!main().querySelector("[data-message-selection-bar]"));
	expect(mainEditor()).toBeNull();
	const toggleOf = (text: string) =>
		articleWithText(main(), text)
			?.closest("[data-message-select]")
			?.querySelector<HTMLElement>(
				"[data-message-select-toggle]",
			) as HTMLElement;
	expect(third).toBeTruthy();
	await userEvent.click(toggleOf("Select three"), {
		modifiers: ["Shift"],
	} as never);
	await until(
		() =>
			main()
				.querySelector("[data-message-selection-bar]")
				?.textContent?.includes("3 messages") ?? false,
	);
	await until(() => !document.querySelector("[role='menu']"));
	await userEvent.keyboard("{Escape}");
	await until(() => !main().querySelector("[data-message-selection-bar]"));
	expect(mainEditor()).not.toBeNull();
});

it("starts a thread draft in the right pane from the right-click menu", async () => {
	await mount();
	const article = await send("Thread starter");
	article.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: article.getBoundingClientRect().left + 120,
			clientY: article.getBoundingClientRect().top + 10,
		}),
	);
	const menuItem = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>("[role='menuitem']"),
		).find((entry) => entry.textContent?.includes("Open thread"));
	await until(() => !!menuItem());
	await userEvent.click(menuItem() as HTMLElement);
	await until(
		() =>
			!!document.querySelector("[data-shell-thread] [data-thread-draft-view]"),
	);
	expect(location.pathname).toMatch(new RegExp(`^${DEV_PATH}/t/new/`));
	expect(main().querySelector("[data-channel-view='desktop']")).not.toBeNull();
	await userEvent.click(
		document.querySelector(
			"[data-shell-thread] button[aria-label='Discard thread']",
		) as HTMLElement,
	);
	await until(() => !document.querySelector("[data-shell-thread]"));
	expect(location.pathname).toBe(DEV_PATH);
});
