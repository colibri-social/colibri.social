import { createEffect, onCleanup, onMount } from "solid-js";

export type ScrollOrigin = { element: Element; top: number; left: number };

export type ClipBox = {
	top: number;
	left: number;
	right: number;
	bottom: number;
};

const CLIPPING = /(auto|scroll|overlay|hidden|clip)/;

export const scrollOrigins = (anchor: Element): ScrollOrigin[] => {
	const elements: Element[] = [];
	let node = anchor.parentElement;
	while (node && node !== document.body && node !== document.documentElement) {
		const style = getComputedStyle(node);
		if (CLIPPING.test(`${style.overflowX} ${style.overflowY}`))
			elements.push(node);
		node = node.parentElement;
	}
	if (document.scrollingElement) elements.push(document.scrollingElement);
	return elements.map((element) => ({
		element,
		top: element.scrollTop,
		left: element.scrollLeft,
	}));
};

export const scrollShift = (origins: readonly ScrollOrigin[]) =>
	origins.reduce(
		(shift, origin) => ({
			x: shift.x + origin.element.scrollLeft - origin.left,
			y: shift.y + origin.element.scrollTop - origin.top,
		}),
		{ x: 0, y: 0 },
	);

export const intersectBoxes = (boxes: readonly ClipBox[]): ClipBox =>
	boxes.reduce((clip, box) => ({
		top: Math.max(clip.top, box.top),
		left: Math.max(clip.left, box.left),
		right: Math.min(clip.right, box.right),
		bottom: Math.min(clip.bottom, box.bottom),
	}));

export const overlapsBox = (rect: ClipBox, clip: ClipBox) =>
	rect.bottom > clip.top &&
	rect.top < clip.bottom &&
	rect.right > clip.left &&
	rect.left < clip.right;

const viewportBox = (): ClipBox => ({
	top: 0,
	left: 0,
	right: window.innerWidth,
	bottom: window.innerHeight,
});

export const clipBox = (origins: readonly ScrollOrigin[]) =>
	intersectBoxes([
		viewportBox(),
		...origins
			.filter((origin) => origin.element !== document.scrollingElement)
			.map((origin) => origin.element.getBoundingClientRect()),
	]);

export type AnchorScrollOptions = {
	active: () => boolean;
	snapshot: () => DOMRect | undefined;
	onLeave: () => void;
};

export const createAnchorScroll = (options: AnchorScrollOptions) => {
	let anchor: HTMLElement | undefined;
	let origins: ScrollOrigin[] = [];

	const track = (element?: HTMLElement) => {
		if (!element || element === anchor || !options.active()) return;
		anchor = element;
		origins = scrollOrigins(element);
	};

	const rect = (element?: HTMLElement): DOMRect | undefined => {
		track(element);
		const snapshot = options.snapshot();
		if (snapshot) {
			const shift = scrollShift(origins);
			return new DOMRect(
				snapshot.x - shift.x,
				snapshot.y - shift.y,
				snapshot.width,
				snapshot.height,
			);
		}
		if (!element?.isConnected) return undefined;
		return element.getBoundingClientRect();
	};

	createEffect(() => {
		if (options.active()) return;
		anchor = undefined;
		origins = [];
	});

	onMount(() => {
		const onScroll = (event: Event) => {
			if (!anchor || !options.active()) return;
			const target =
				event.target === document ? document.scrollingElement : event.target;
			if (!origins.some((origin) => origin.element === target)) return;
			const current = rect(anchor);
			if (!current || !overlapsBox(current, clipBox(origins)))
				options.onLeave();
		};
		document.addEventListener("scroll", onScroll, {
			capture: true,
			passive: true,
		});
		onCleanup(() =>
			document.removeEventListener("scroll", onScroll, { capture: true }),
		);
	});

	return { rect };
};
