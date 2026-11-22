import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import "../../app.css";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import {
	articleWithText as desktopArticle,
	main,
	mount as mountDesktop,
	send,
} from "./desktop-test-kit";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", "/");
});

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 701,
		isPrimary: true,
		button: 0,
		clientX: box.left + box.width / 2,
		clientY: box.top + Math.min(20, box.height / 2),
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(500);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const pane = () => host?.querySelector('[data-pane-index="1"]') as HTMLElement;

const articleWithText = (text: string) =>
	Array.from(pane().querySelectorAll<HTMLElement>("article")).find((article) =>
		article.textContent?.includes(text),
	);

const buttonNamed = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			(element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
			name,
	);

const mountMobile = async () => {
	setLatency(0);
	history.replaceState(null, "", DEV_PATH);
	const store = createDataStore(createMockSource({ live: false }));
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(
		() => (pane()?.querySelectorAll("[data-message]").length ?? 0) > 3,
	);
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const dev = community
		? store.space(community).channelBySlug("dev")
		: undefined;
	if (!dev) throw new Error("dev missing");
	return { store, dev };
};

it("asks before deleting a message from the mobile hold drawer", async () => {
	const { store, dev } = await mountMobile();
	await store.channel(dev.space).send({ text: "Hold to delete me" });
	await until(() => !!articleWithText("Hold to delete me"));
	await wait(400);
	await hold(articleWithText("Hold to delete me") as HTMLElement);
	const drawerDelete = () =>
		Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']"))
			.map((dialog) => buttonNamed(dialog, "Delete message"))
			.find(Boolean);
	await until(() => !!drawerDelete());
	await wait(300);
	(drawerDelete() as HTMLElement).click();
	const confirm = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[role='alertdialog'], [role='dialog']",
			),
		).find((dialog) => dialog.textContent?.includes("Delete message?"));
	await until(() => !!confirm());
	expect(articleWithText("Hold to delete me")).toBeTruthy();
	const cancel = buttonNamed(confirm() as HTMLElement, "Cancel") as HTMLElement;
	cancel.click();
	await until(() => !confirm());
	expect(articleWithText("Hold to delete me")).toBeTruthy();
	await hold(articleWithText("Hold to delete me") as HTMLElement);
	await until(() => !!drawerDelete());
	await wait(300);
	(drawerDelete() as HTMLElement).click();
	await until(() => !!confirm());
	await wait(200);
	(
		buttonNamed(confirm() as HTMLElement, "Delete message") as HTMLElement
	).click();
	await until(() => !articleWithText("Hold to delete me"));
});

it("asks to delete when a mobile edit is saved empty", async () => {
	const { store, dev } = await mountMobile();
	await store.channel(dev.space).send({ text: "Empty me out" });
	await until(() => !!articleWithText("Empty me out"));
	await wait(400);
	await hold(articleWithText("Empty me out") as HTMLElement);
	const drawerEdit = () =>
		Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']"))
			.map((dialog) => buttonNamed(dialog, "Edit message"))
			.find(Boolean);
	await until(() => !!drawerEdit());
	await wait(300);
	(drawerEdit() as HTMLElement).click();
	const composer = () =>
		pane().querySelector<HTMLElement>("[contenteditable='true']");
	await until(() => composer()?.textContent === "Empty me out");
	await userEvent.click(composer() as HTMLElement);
	await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}{Backspace}");
	await until(() => composer()?.textContent?.trim() === "");
	const save = buttonNamed(pane(), "Save edit") as HTMLElement;
	await until(() => !save.hasAttribute("disabled"));
	save.click();
	await until(() => !!confirmDialog());
	await wait(200);
	(
		buttonNamed(confirmDialog() as HTMLElement, "Delete message") as HTMLElement
	).click();
	await until(() => !articleWithText("Empty me out"));
	expect(buttonNamed(pane(), "Save edit")).toBeUndefined();
});

const confirmDialog = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			"[role='alertdialog'], [role='dialog']",
		),
	).find((dialog) => dialog.textContent?.includes("Delete message?"));

const inlineEditor = () =>
	main().querySelector<HTMLElement>(
		"[data-message-editor] [contenteditable='true']",
	);

const clearAndSubmit = async () => {
	await until(() => !!inlineEditor());
	await wait(150);
	await userEvent.click(inlineEditor() as HTMLElement);
	await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}{Backspace}");
	await until(() => inlineEditor()?.textContent?.trim() === "");
	await userEvent.keyboard("{Enter}");
};

it("asks to delete when an edit is submitted empty, and Enter confirms", async () => {
	await mountDesktop();
	const article = await send("Edit me away");
	const key = article.dataset.messageKey;
	const present = () =>
		!!main().querySelector(`article[data-message-key="${key}"]`);
	await userEvent.keyboard("{ArrowUp}");
	await clearAndSubmit();
	await until(() => !!confirmDialog());
	const confirmButton = buttonNamed(
		confirmDialog() as HTMLElement,
		"Delete message",
	);
	await until(() => document.activeElement === confirmButton);
	await userEvent.keyboard("{Escape}");
	await until(() => !confirmDialog());
	expect(present()).toBe(true);
	expect(inlineEditor()).not.toBeNull();

	await clearAndSubmit();
	await until(() => !!confirmDialog());
	await until(
		() =>
			document.activeElement ===
			buttonNamed(confirmDialog() as HTMLElement, "Delete message"),
	);
	await userEvent.keyboard("{Enter}");
	await until(() => !present());
	expect(inlineEditor()).toBeNull();
	expect(desktopArticle(main(), "Edit me away")).toBeUndefined();
});
