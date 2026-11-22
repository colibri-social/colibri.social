import { afterEach, expect, it } from "vitest";
import { installContextMenuGuard } from "./context-menu-guard";

const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };
const cleanups: (() => void)[] = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	delete tauriWindow.__TAURI_INTERNALS__;
});

const target = (tag = "div") => {
	const element = document.createElement(tag);
	element.textContent = "target";
	element.style.width = "120px";
	element.style.height = "40px";
	document.body.append(element);
	cleanups.push(() => element.remove());
	return element;
};

const rightClick = (element: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	const event = new MouseEvent("contextmenu", {
		bubbles: true,
		cancelable: true,
		clientX: rect.left + rect.width / 2,
		clientY: rect.top + rect.height / 2,
		button: 2,
	});
	element.dispatchEvent(event);
	return event;
};

it("keeps the browser context menu on the web", () => {
	cleanups.push(installContextMenuGuard());
	expect(rightClick(target()).defaultPrevented).toBe(false);
});

it("suppresses the native context menu inside Tauri", () => {
	tauriWindow.__TAURI_INTERNALS__ = {};
	cleanups.push(installContextMenuGuard());
	expect(rightClick(target()).defaultPrevented).toBe(true);
});

it("keeps the native menu for text inputs inside Tauri", () => {
	tauriWindow.__TAURI_INTERNALS__ = {};
	cleanups.push(installContextMenuGuard());
	expect(rightClick(target("textarea")).defaultPrevented).toBe(false);
});
