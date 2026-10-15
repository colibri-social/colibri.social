import { onCleanup } from "solid-js";

const LEFT = "--toast-left";
const BOTTOM = "--toast-bottom";
const WIDTH = "--toast-width";
const GAP = 8;
const MIN_WIDTH = 280;
const SETTLE_FRAMES = 30;

export const anchorToasts = (dock: HTMLElement) => {
	const root = document.documentElement;
	const clear = () => {
		for (const property of [LEFT, BOTTOM, WIDTH])
			root.style.removeProperty(property);
	};
	let watched: HTMLElement | undefined;
	const watchPopover = (popover: HTMLElement | undefined) => {
		if (popover === watched) return;
		if (watched) popoverSize.unobserve(watched);
		watched = popover;
		if (popover) popoverSize.observe(popover);
	};
	const openPopover = () => {
		const trigger = dock.querySelector<HTMLElement>(
			'[aria-expanded="true"][aria-controls]',
		);
		const id = trigger?.getAttribute("aria-controls");
		const popover = id ? document.getElementById(id) : null;
		return popover?.isConnected ? popover : undefined;
	};
	const sync = () => {
		if (!dock.isConnected) {
			clear();
			return;
		}
		const panel = dock.querySelector<HTMLElement>("[data-user-panel]") ?? dock;
		const rect = panel.getBoundingClientRect();
		const popover = openPopover();
		watchPopover(popover);
		const top = Math.min(
			rect.top,
			popover?.getBoundingClientRect().top ?? rect.top,
		);
		root.style.setProperty(LEFT, `${Math.round(rect.left)}px`);
		root.style.setProperty(
			BOTTOM,
			`${Math.max(0, Math.round(window.innerHeight - top + GAP))}px`,
		);
		root.style.setProperty(
			WIDTH,
			`${Math.round(Math.max(rect.width, MIN_WIDTH))}px`,
		);
	};
	let frame = 0;
	let settled = 0;
	const settle = () => {
		sync();
		settled += 1;
		frame = settled < SETTLE_FRAMES ? requestAnimationFrame(settle) : 0;
	};
	const resettle = () => {
		cancelAnimationFrame(frame);
		settled = 0;
		frame = requestAnimationFrame(settle);
	};
	const popoverSize = new ResizeObserver(resettle);
	const expansion = new MutationObserver(resettle);
	expansion.observe(dock, {
		subtree: true,
		attributes: true,
		attributeFilter: ["aria-expanded"],
	});
	const portals = new MutationObserver(() => {
		if (dock.querySelector('[aria-expanded="true"][aria-controls]')) resettle();
	});
	portals.observe(document.body, { childList: true });
	const observer = new ResizeObserver(sync);
	observer.observe(dock);
	window.addEventListener("resize", sync);
	sync();
	onCleanup(() => {
		observer.disconnect();
		expansion.disconnect();
		popoverSize.disconnect();
		portals.disconnect();
		cancelAnimationFrame(frame);
		window.removeEventListener("resize", sync);
		clear();
	});
};
