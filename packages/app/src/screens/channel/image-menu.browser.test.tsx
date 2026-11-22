import { afterEach, expect, it } from "vitest";
import {
	cleanupMounted,
	main,
	menuItem,
	mount,
	until,
} from "./desktop-test-kit";

afterEach(() => {
	cleanupMounted();
});

const firstImageTile = () =>
	main().querySelector<HTMLElement>("[data-media-tile][data-image-src]");

it("offers copy and download for an image in its own menu group", async () => {
	await mount();
	await until(() => !!firstImageTile());
	const tile = firstImageTile() as HTMLElement;
	tile.scrollIntoView({ block: "center" });
	await new Promise((resolve) => setTimeout(resolve, 150));
	const box = tile.getBoundingClientRect();
	const event = new MouseEvent("contextmenu", {
		bubbles: true,
		cancelable: true,
		button: 2,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	});
	tile.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
	await until(() => !!menuItem("Copy image"));
	expect(menuItem("Download image")).toBeTruthy();
	const labels = Array.from(
		document.querySelectorAll<HTMLElement>("[role='menuitem']"),
	).map((item) => item.textContent?.trim());
	expect(labels.indexOf("Copy image")).toBeLessThan(
		labels.indexOf("Download image"),
	);
	expect(labels.indexOf("Download image")).toBeLessThan(
		labels.indexOf("Reply"),
	);
});

it("leaves the image group out when the message is right-clicked on its text", async () => {
	await mount();
	const text = main().querySelector<HTMLElement>(
		"article[data-message-key] [data-rich-text]",
	);
	if (!text) throw new Error("no message text");
	const box = text.getBoundingClientRect();
	text.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: box.left + 4,
			clientY: box.top + box.height / 2,
		}),
	);
	await until(() => !!menuItem("Reply"));
	expect(menuItem("Copy image")).toBeUndefined();
});
