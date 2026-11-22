import { createRoot } from "solid-js";
import { afterEach, expect, it } from "vitest";
import { anchorToasts } from "./toast-anchor";

const frames = (count: number) =>
	new Promise<void>((resolve) => {
		const step = (left: number) =>
			left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1));
		step(count);
	});

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

const toastBottom = () =>
	Number.parseFloat(
		document.documentElement.style.getPropertyValue("--toast-bottom"),
	);

it("lifts the toasts above a popover that mounts long after it opens", async () => {
	const dock = document.createElement("div");
	dock.style.cssText = "position:fixed;left:0;bottom:0;width:300px;height:60px";
	const trigger = document.createElement("button");
	trigger.setAttribute("aria-controls", "late-popover");
	trigger.setAttribute("aria-expanded", "false");
	dock.append(trigger);
	document.body.append(dock);
	createRoot((dispose) => {
		cleanup = dispose;
		anchorToasts(dock);
	});
	trigger.setAttribute("aria-expanded", "true");
	await frames(45);
	const dockOnly = toastBottom();
	const popover = document.createElement("div");
	popover.id = "late-popover";
	popover.style.cssText =
		"position:fixed;left:0;bottom:80px;width:280px;height:200px";
	const portal = document.createElement("div");
	portal.append(popover);
	document.body.append(portal);
	await frames(3);
	const top = popover.getBoundingClientRect().top;
	expect(toastBottom()).toBeGreaterThan(dockOnly);
	expect(toastBottom()).toBe(Math.round(window.innerHeight - top + 8));
});
