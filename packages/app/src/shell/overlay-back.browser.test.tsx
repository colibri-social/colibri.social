import { afterEach, expect, it, vi } from "vitest";
import { installOverlayBack } from "./overlay-back";

const frames = (count = 2) =>
	new Promise<void>((resolve) => {
		const step = (left: number) =>
			left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
		step(count);
	});

let uninstall: (() => void) | undefined;

afterEach(() => {
	uninstall?.();
	vi.restoreAllMocks();
	for (const dialog of document.querySelectorAll('[role="dialog"]')) {
		dialog.remove();
	}
});

const openDialog = () => {
	const dialog = document.createElement("div");
	dialog.setAttribute("role", "dialog");
	dialog.addEventListener("keydown", (event) => {
		if (event.key === "Escape") dialog.remove();
	});
	document.body.append(dialog);
	return dialog;
};

it("closes the top overlay on back and keeps the screen", async () => {
	const push = vi
		.spyOn(window.history, "pushState")
		.mockImplementation(() => {});
	vi.spyOn(window.history, "go").mockImplementation(() => {});
	uninstall = installOverlayBack();
	const screenPops: unknown[] = [];
	const listener = (event: PopStateEvent) => screenPops.push(event.state);
	window.addEventListener("popstate", listener);
	const dialog = openDialog();
	await frames();
	expect(push).toHaveBeenCalledWith(
		expect.objectContaining({ colibriOverlay: 1 }),
		"",
	);
	window.dispatchEvent(
		new PopStateEvent("popstate", { state: { colibriDepth: 1 } }),
	);
	await frames();
	expect(dialog.isConnected).toBe(false);
	expect(screenPops).toEqual([]);
	window.removeEventListener("popstate", listener);
});

it("drops its history entry when the overlay closes by itself", async () => {
	let state: unknown = { colibriDepth: 1 };
	vi.spyOn(window.history, "state", "get").mockImplementation(() => state);
	vi.spyOn(window.history, "pushState").mockImplementation((next) => {
		state = next;
	});
	const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
	uninstall = installOverlayBack();
	const dialog = openDialog();
	await frames();
	dialog.remove();
	await frames();
	expect(go).toHaveBeenCalledWith(-1);
	const screenPops: unknown[] = [];
	const listener = (event: PopStateEvent) => screenPops.push(event.state);
	window.addEventListener("popstate", listener);
	window.dispatchEvent(
		new PopStateEvent("popstate", { state: { colibriDepth: 1 } }),
	);
	expect(screenPops).toEqual([]);
	window.removeEventListener("popstate", listener);
});
