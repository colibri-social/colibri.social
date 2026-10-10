export type AutoscrollEdges = {
	start: number;
	end: number;
};

export type AutoscrollTuning = {
	zone?: number;
	maxSpeed?: number;
};

const DEFAULT_ZONE = 72;
const DEFAULT_MAX_SPEED = 1400;

export const rubberBand = (
	offset: number,
	dimension: number,
	constant = 0.55,
) =>
	Math.sign(offset) *
	(1 - 1 / ((Math.abs(offset) * constant) / dimension + 1)) *
	dimension;

export const autoscrollSpeed = (
	position: number,
	edges: AutoscrollEdges,
	tuning: AutoscrollTuning = {},
) => {
	const size = edges.end - edges.start;
	if (size <= 0) return 0;
	const zone = Math.min(tuning.zone ?? DEFAULT_ZONE, size / 4);
	const maxSpeed = tuning.maxSpeed ?? DEFAULT_MAX_SPEED;
	const ramp = (depth: number) => Math.min(1, Math.max(0, depth / zone)) ** 2;
	const intoStart = edges.start + zone - position;
	if (intoStart > 0) return -maxSpeed * ramp(intoStart);
	const intoEnd = position - (edges.end - zone);
	if (intoEnd > 0) return maxSpeed * ramp(intoEnd);
	return 0;
};

const scrolls = (element: Element) => {
	const overflow = getComputedStyle(element).overflowY;
	return (
		(overflow === "auto" || overflow === "scroll" || overflow === "overlay") &&
		element.scrollHeight > element.clientHeight
	);
};

export const scrollParent = (element: Element): HTMLElement => {
	for (
		let node = element.parentElement;
		node && node !== document.body && node !== document.documentElement;
		node = node.parentElement
	) {
		if (scrolls(node)) return node;
	}
	return (document.scrollingElement ?? document.documentElement) as HTMLElement;
};

const isDocumentScroller = (element: Element) =>
	element === document.scrollingElement || element === document.documentElement;

export const scrollerViewport = (scroller: HTMLElement): AutoscrollEdges => {
	if (isDocumentScroller(scroller))
		return {
			start: 0,
			end: window.visualViewport?.height ?? window.innerHeight,
		};
	const rect = scroller.getBoundingClientRect();
	return { start: rect.top, end: rect.bottom };
};

export const contentOffset = (scroller: HTMLElement, clientY: number) =>
	clientY - scrollerViewport(scroller).start + scroller.scrollTop;

export const createAutoscroller = (options: {
	scroller: HTMLElement;
	onScroll: () => void;
	tuning?: AutoscrollTuning;
}) => {
	let pointerY = 0;
	let frame = 0;
	let last = 0;

	const tick = (now: number) => {
		frame = 0;
		const speed = autoscrollSpeed(
			pointerY,
			scrollerViewport(options.scroller),
			options.tuning,
		);
		if (speed === 0) {
			last = 0;
			return;
		}
		const elapsed = last === 0 ? 16 : Math.min(48, now - last);
		last = now;
		const before = options.scroller.scrollTop;
		options.scroller.scrollTop = before + (speed * elapsed) / 1000;
		if (options.scroller.scrollTop === before) {
			last = 0;
			return;
		}
		options.onScroll();
		frame = requestAnimationFrame(tick);
	};

	return {
		update: (clientY: number) => {
			pointerY = clientY;
			if (frame === 0) frame = requestAnimationFrame(tick);
		},
		stop: () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			frame = 0;
			last = 0;
		},
	};
};
