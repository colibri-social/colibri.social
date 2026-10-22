import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	main,
	mainEditor,
	menuItem,
	mount,
	rightClick,
	send,
	until,
} from "./desktop-test-kit";

const replyBar = () =>
	main().querySelector<HTMLElement>('[data-composer-bar="reply"]');

it("dismisses the reply on Escape and keeps the composer text", async () => {
	await mount();
	const target = await send("Reply escape target");
	rightClick(target);
	await until(() => !!menuItem("Reply"));
	await userEvent.click(menuItem("Reply") as HTMLElement);
	await until(() => replyBar()?.hasAttribute("data-open") === true);

	await userEvent.click(mainEditor());
	await userEvent.keyboard("Draft stays");
	await userEvent.keyboard("{Escape}");

	await until(() => replyBar()?.hasAttribute("data-open") === false);
	expect(mainEditor().textContent).toBe("Draft stays");
});

const tray = () => main().querySelector("[data-attachment-draft]");

const dropFile = async () => {
	const zone = main().querySelector(
		"[data-attachment-dropzone]",
	) as HTMLElement;
	const area = zone.querySelector("[data-message-list-scroller]") ?? zone;
	const transfer = new DataTransfer();
	transfer.items.add(
		new File(["notes"], "crow-notes.pdf", { type: "application/pdf" }),
	);
	for (const type of ["dragenter", "dragover", "drop"]) {
		area.dispatchEvent(
			new DragEvent(type, {
				bubbles: true,
				cancelable: true,
				dataTransfer: transfer,
			}),
		);
	}
	await until(() => !!tray());
};

it("clears attachments on Escape and keeps the composer text", async () => {
	await mount();
	await dropFile();

	await userEvent.click(mainEditor());
	await userEvent.keyboard("Draft stays");
	await userEvent.keyboard("{Escape}");

	await until(() => !tray());
	expect(mainEditor().textContent).toBe("Draft stays");
});

it("cancels the reply and clears attachments with one Escape", async () => {
	await mount();
	const target = await send("Reply and attachment target");
	rightClick(target);
	await until(() => !!menuItem("Reply"));
	await userEvent.click(menuItem("Reply") as HTMLElement);
	await until(() => replyBar()?.hasAttribute("data-open") === true);
	await dropFile();

	await userEvent.click(mainEditor());
	await userEvent.keyboard("{Escape}");

	await until(() => replyBar()?.hasAttribute("data-open") === false);
	await until(() => !tray());
});

it("closes an open suggestion popup before clearing attachments", async () => {
	await mount();
	await dropFile();

	await userEvent.click(mainEditor());
	await userEvent.keyboard("@zz");
	await until(() => !!main().querySelector("[data-suggestions]"));
	await userEvent.keyboard("{Escape}");

	await until(() => !main().querySelector("[data-suggestions]"));
	expect(tray()).not.toBeNull();

	await userEvent.keyboard("{Escape}");
	await until(() => !tray());
});
