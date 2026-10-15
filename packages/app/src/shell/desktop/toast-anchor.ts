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
	const openPopoverTop = () => {
		const trigger = dock.querySelector<HTMLElement>(
			'[aria-expanded="true"][aria-controls]',
		);
		const id = trigger?.getAttribute("aria-controls");
		const popover = id ? document.getElementById(id) : null;
		return popover?.isConnected
			? popover.getBoundingClientRect().top
			: undefined;
	};
	const sync = () => {
		if (!dock.isConnected) {
			clear();
			return;
		}
		const panel = dock.querySelector<HTMLElement>("[data-user-panel]") ?? dock;
		const rect = panel.getBoundingClientRect();
		const top = Math.min(rect.top, openPopoverTop() ?? rect.top);
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
	const expansion = new MutationObserver(() => {
		cancelAnimationFrame(frame);
		settled = 0;
		frame = requestAnimationFrame(settle);
	});
	expansion.observe(dock, {
		subtree: true,
		attributes: true,
		attributeFilter: ["aria-expanded"],
	});
	const observer = new ResizeObserver(sync);
	observer.observe(dock);
	window.addEventListener("resize", sync);
	sync();
	onCleanup(() => {
		observer.disconnect();
		expansion.disconnect();
		cancelAnimationFrame(frame);
		window.removeEventListener("resize", sync);
		clear();
	});
};
