const DECIDE_PX = 4;

type Decision = "pending" | "native" | "block";

const scrollsOnAxis = (style: CSSStyleDeclaration, axis: "x" | "y") =>
	/auto|scroll/.test(axis === "x" ? style.overflowX : style.overflowY);

const canScroll = (element: Element, axis: "x" | "y", delta: number) => {
	if (axis === "y") {
		const max = element.scrollHeight - element.clientHeight;
		if (max <= 1) return false;
		return delta < 0 ? element.scrollTop < max - 1 : element.scrollTop > 1;
	}
	const max = element.scrollWidth - element.clientWidth;
	if (max <= 1) return false;
	const position = Math.abs(element.scrollLeft);
	return delta < 0 ? position < max - 1 : position > 1;
};

const ownsGesture = (target: Element) =>
	!!target.closest(
		'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-gesture="own"]',
	);

export const hasNativeScroll = (
	target: Element,
	axis: "x" | "y",
	delta: number,
) => {
	if (ownsGesture(target)) return true;
	for (
		let element: Element | null = target;
		element && element !== document.documentElement;
		element = element.parentElement
	) {
		if (
			scrollsOnAxis(getComputedStyle(element), axis) &&
			canScroll(element, axis, delta)
		) {
			return true;
		}
	}
	return false;
};

export const installFlingGuard = () => {
	let startX = 0;
	let startY = 0;
	let target: Element | null = null;
	let decision: Decision = "pending";

	const onStart = (event: TouchEvent) => {
		if (event.touches.length !== 1) {
			decision = "native";
			return;
		}
		const touch = event.touches[0];
		if (!touch) return;
		startX = touch.clientX;
		startY = touch.clientY;
		target = event.target instanceof Element ? event.target : null;
		decision = "pending";
	};

	const onMove = (event: TouchEvent) => {
		if (decision === "native") return;
		if (decision === "pending") {
			const touch = event.touches[0];
			if (!touch || !target) return;
			const dx = touch.clientX - startX;
			const dy = touch.clientY - startY;
			if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE_PX) return;
			const horizontal = Math.abs(dx) > Math.abs(dy);
			decision = hasNativeScroll(
				target,
				horizontal ? "x" : "y",
				horizontal ? dx : dy,
			)
				? "native"
				: "block";
		}
		if (decision === "block" && event.cancelable) event.preventDefault();
	};

	const startOptions = { capture: true, passive: true } as const;
	const moveOptions = { capture: true, passive: false } as const;
	document.addEventListener("touchstart", onStart, startOptions);
	document.addEventListener("touchmove", onMove, moveOptions);
	return () => {
		document.removeEventListener("touchstart", onStart, startOptions);
		document.removeEventListener("touchmove", onMove, moveOptions);
	};
};
