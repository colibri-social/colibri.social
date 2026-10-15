import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { DEFAULT_COMPOSER } from "../../data/preferences/types";
import {
	articleWithText,
	DEV_PATH,
	HQ,
	main,
	menuItem,
	mount,
	rightClick,
	send,
	TEXT,
	until,
	wait,
} from "./desktop-test-kit";

const HQ_PATH = (channel: string) => `/app/c/${HQ}/${TEXT}/${channel}`;
const TRAIL = "did:plc:trailheadsclub4i6j8k2m";
const OWLS = "did:plc:nightowlsartclub3e5f7g9h";
const SOLID = "https://docs.solidjs.com/concepts/signals";

const dialogWith = (text: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			"[role='dialog'], [role='alertdialog']",
		),
	).find((dialog) => dialog.textContent?.includes(text));

const buttonIn = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(button) =>
			(button.getAttribute("aria-label") ?? button.textContent?.trim()) ===
			name,
	);

const openMenu = async (target: HTMLElement, item: string) => {
	rightClick(target);
	await until(() => !!document.querySelector("[role='menu']"));
	await wait(50);
	return menuItem(item);
};

const closeMenu = async () => {
	await userEvent.keyboard("{Escape}");
	await until(() => !document.querySelector("[role='menu']"));
};

const holdShift = (held: boolean) =>
	window.dispatchEvent(
		new KeyboardEvent(held ? "keydown" : "keyup", {
			key: "Shift",
			shiftKey: held,
		}),
	);

const waitDialogsClosed = () =>
	until(
		() =>
			!document.querySelector("[role='dialog'], [role='alertdialog']") &&
			!document.querySelector("[role='menu']"),
	);

const byKey = (key: string | null) =>
	main().querySelector<HTMLElement>(`article[data-message-key="${key}"]`);

const findArticle = async (text: string) => {
	const scroller = main().querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;
	const started = performance.now();
	while (!articleWithText(main(), text)) {
		if (performance.now() - started > 8000) {
			throw new Error(`No message with ${text}`);
		}
		scroller.scrollTop = Math.max(0, scroller.scrollTop - 600);
		await wait(80);
	}
	articleWithText(main(), text)?.scrollIntoView({ block: "center" });
	await wait(200);
	return articleWithText(main(), text) as HTMLElement;
};

afterEach(() => {
	holdShift(false);
	vi.restoreAllMocks();
});

describe("message link actions", () => {
	it("offers open and copy link when right-clicking a link", async () => {
		await mount();
		const article = await findArticle("Signals docs");
		const link = article.querySelector<HTMLAnchorElement>(
			`a[href="${SOLID}"]`,
		) as HTMLAnchorElement;
		const writeText = vi
			.spyOn(navigator.clipboard, "writeText")
			.mockResolvedValue();
		await userEvent.click((await openMenu(link, "Copy link")) as HTMLElement);
		await until(() => writeText.mock.calls.length > 0);
		expect(writeText).toHaveBeenCalledWith(SOLID);
		await waitDialogsClosed();
		await userEvent.click((await openMenu(link, "Open link")) as HTMLElement);
		await until(() => !!document.querySelector("[data-link-warning]"));
		expect(
			document.querySelector("[data-link-warning-host]")?.textContent,
		).toContain("docs.solidjs.com");
		await userEvent.keyboard("{Escape}");
		await waitDialogsClosed();
		const body = article.querySelector<HTMLElement>(
			"[data-message-header]",
		) as HTMLElement;
		await openMenu(body, "Copy text");
		expect(menuItem("Open link")).toBeUndefined();
		expect(menuItem("Copy link")).toBeUndefined();
		await closeMenu();
	});

	it("copies text with facets as HTML and plain text", async () => {
		await mount();
		const article = await findArticle("Signals docs");
		const write = vi.spyOn(navigator.clipboard, "write").mockResolvedValue();
		await userEvent.click(
			(await openMenu(article, "Copy text")) as HTMLElement,
		);
		await until(() => write.mock.calls.length > 0);
		const item = write.mock.calls[0]?.[0]?.[0] as ClipboardItem;
		expect([...item.types].sort()).toEqual(["text/html", "text/plain"]);
		const html = await (await item.getType("text/html")).text();
		expect(html).toContain("data-colibri-message");
		const plain = await (await item.getType("text/plain")).text();
		expect(plain).toContain("Signals docs for anyone new to Solid");
	});
});

describe("message moderation", () => {
	it("confirms before hiding, and Shift skips the confirmation", async () => {
		await mount();
		const first = await findArticle("Heads up: the beta API");
		const firstKey = first.getAttribute("data-message-key");
		await userEvent.click(
			(await openMenu(first, "Hide message")) as HTMLElement,
		);
		await until(() => !!dialogWith("Hide message?"));
		expect(first.querySelector("[data-hidden-message]")).toBeNull();
		await wait(200);
		await userEvent.click(
			buttonIn(
				dialogWith("Hide message?") as HTMLElement,
				"Hide message",
			) as HTMLElement,
		);
		await until(
			() => !!byKey(firstKey)?.querySelector("[data-hidden-message]"),
		);
		await waitDialogsClosed();
		const second = await findArticle("Signals docs");
		const secondKey = second.getAttribute("data-message-key");
		const item = await openMenu(second, "Hide message");
		holdShift(true);
		await userEvent.click(item as HTMLElement);
		holdShift(false);
		await until(
			() => !!byKey(secondKey)?.querySelector("[data-hidden-message]"),
		);
		expect(dialogWith("Hide message?")).toBeUndefined();
	});

	it("deletes from the context menu without asking while Shift is held", async () => {
		await mount();
		const article = await send("Shift deletes me");
		const item = await openMenu(article, "Delete message");
		holdShift(true);
		await userEvent.click(item as HTMLElement);
		holdShift(false);
		await until(() => !articleWithText(main(), "Shift deletes me"));
		expect(dialogWith("Delete message?")).toBeUndefined();
	});
});

describe("link previews", () => {
	it("lets a moderator hide a preview from the dialog", async () => {
		await mount();
		await findArticle("Signals docs");
		const article = () =>
			articleWithText(main(), "Signals docs") as HTMLElement;
		expect(article().querySelector("[data-link-embed]")).not.toBeNull();
		await userEvent.click(
			(await openMenu(article(), "Link previews")) as HTMLElement,
		);
		await until(() => !!document.querySelector("[data-link-previews]"));
		const dialog = dialogWith("Link previews") as HTMLElement;
		expect(dialog.textContent).toContain("docs.solidjs.com");
		expect(dialog.textContent).toContain("acting as a moderator");
		await wait(200);
		await userEvent.click(
			dialog.querySelector(
				"[data-link-preview-row] [data-switch-control]",
			) as HTMLElement,
		);
		await userEvent.click(buttonIn(dialog, "Save") as HTMLElement);
		await until(() => !article().querySelector("[data-link-embed]"));
	});

	it("removes an own preview straight away with Shift and the close button", async () => {
		await mount(HQ_PATH("announcements"));
		await findArticle("New docs for bridges");
		const article = () =>
			articleWithText(main(), "New docs for bridges") as HTMLElement;
		await until(() => !!article()?.querySelector("[data-link-embed]"));
		const remove = buttonIn(article(), "Remove link preview") as HTMLElement;
		expect(remove).toBeTruthy();
		remove.dispatchEvent(
			new MouseEvent("click", { bubbles: true, shiftKey: true }),
		);
		await until(() => !article().querySelector("[data-link-embed]"));
		expect(document.querySelector("[data-link-previews]")).toBeNull();
	});
});

describe("message menu extras", () => {
	it("shows debug information only in developer mode", async () => {
		const { store } = await mount();
		const article = await findArticle("Signals docs");
		await openMenu(article, "Copy text");
		expect(menuItem("Show debug information")).toBeUndefined();
		await closeMenu();
		store.setControls({ developerMode: true });
		await userEvent.click(
			(await openMenu(article, "Show debug information")) as HTMLElement,
		);
		await until(() => !!dialogWith("Debug information"));
		const dialog = dialogWith("Debug information") as HTMLElement;
		expect(buttonIn(dialog, "Copy AT-URI")).toBeTruthy();
		expect(
			dialog.querySelector<HTMLAnchorElement>("a[href*='pdsls.dev']")?.href,
		).toContain("social.colibri.beta.message");
	});

	it("saves and removes a GIF", async () => {
		const { source } = await mount(HQ_PATH("general"));
		await findArticle("gif time");
		const article = () => articleWithText(main(), "gif time") as HTMLElement;
		await userEvent.click(
			(await openMenu(article(), "Save GIF")) as HTMLElement,
		);
		await until(() => source.gifFavorites().length === 1);
		await waitDialogsClosed();
		await userEvent.click(
			(await openMenu(article(), "Remove saved GIF")) as HTMLElement,
		);
		await until(() => source.gifFavorites().length === 0);
	});

	it("builds quick reactions from emoji usage", async () => {
		await mount(DEV_PATH, {
			composer: {
				...DEFAULT_COMPOSER,
				emojiUsage: { "🦜": { count: 3, lastUsed: Date.now() } },
			},
		});
		const article = await findArticle("Signals docs");
		await userEvent.hover(article);
		await until(() => !!article.querySelector("[data-message-toolbar]"));
		const toolbar = article.querySelector(
			"[data-message-toolbar]",
		) as HTMLElement;
		const labels = Array.from(toolbar.querySelectorAll("button"))
			.map((button) => button.getAttribute("aria-label"))
			.filter((label) => label?.startsWith("React with"));
		expect(labels[0]).toBe("React with 🦜");
		expect(labels).toHaveLength(3);
	});
});

describe("message rendering", () => {
	it("highlights role mentions, crowns the owner and renders Bluesky posts", async () => {
		await mount(`/app/c/${TRAIL}/${TEXT}/planning`);
		await findArticle("Route options");
		const mention = await findArticle("Route options");
		expect(
			mention
				.querySelector("[data-highlight]")
				?.getAttribute("data-highlight") ??
				mention.getAttribute("data-highlight"),
		).toBe("mention");
		expect(mention.querySelector("[data-author-owner]")).not.toBeNull();
		const plain = await findArticle("In! I can drive");
		expect(plain.querySelector("[data-author-owner]")).toBeNull();
		const post = await findArticle("Latest from the guides");
		await until(() => !!post.querySelector("[data-bluesky-embed]"));
		expect(post.querySelector("[data-bluesky-embed]")?.textContent).toContain(
			"Tre Cime loop is open again",
		);
	});

	it("hides reply where the viewer can't post", async () => {
		await mount(`/app/c/${OWLS}/${TEXT}/prompts`);
		const article = main().querySelector<HTMLElement>(
			"article[data-message-key]",
		) as HTMLElement;
		await openMenu(article, "Forward");
		expect(menuItem("Reply")).toBeUndefined();
		await closeMenu();
		await userEvent.hover(article);
		await until(() => !!article.querySelector("[data-message-toolbar]"));
		expect(
			buttonIn(
				article.querySelector("[data-message-toolbar]") as HTMLElement,
				"Reply",
			),
		).toBeUndefined();
	});

	it("keeps reply where the viewer can post", async () => {
		await mount(DEV_PATH);
		const article = await findArticle("Signals docs");
		await openMenu(article, "Reply");
		expect(menuItem("Reply")).toBeTruthy();
		await closeMenu();
	});
});
