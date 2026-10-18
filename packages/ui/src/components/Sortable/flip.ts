import {
	motionScale,
	prefersReducedMotion,
	type SpringConfig,
	springEasing,
} from "../../utils/motion";

export const reorderSprings = {
	shift: { stiffness: 520, damping: 42 },
	lift: { stiffness: 620, damping: 32 },
	settle: { stiffness: 480, damping: 36 },
} satisfies Record<string, SpringConfig>;

const FLIP_ANIMATION_ID = "reorder-flip";

export const captureTops = (elements: Iterable<[string, HTMLElement]>) => {
	const tops = new Map<string, number>();
	for (const [key, element] of elements)
		tops.set(key, element.getBoundingClientRect().top);
	return tops;
};

export const cancelFlips = (elements: Iterable<[string, HTMLElement]>) => {
	for (const [, element] of elements)
		for (const animation of element.getAnimations())
			if (animation.id === FLIP_ANIMATION_ID) animation.cancel();
};

export const playFlips = (
	before: Map<string, number>,
	elements: Iterable<[string, HTMLElement]>,
	config: SpringConfig = reorderSprings.shift,
) => {
	if (prefersReducedMotion()) return;
	const { easing, duration } = springEasing(config);
	for (const [key, element] of elements) {
		const from = before.get(key);
		if (from === undefined || !element.animate) continue;
		const delta = from - element.getBoundingClientRect().top;
		if (Math.abs(delta) < 0.5) continue;
		const animation = element.animate(
			[
				{ transform: `translate3d(0, ${delta}px, 0)` },
				{ transform: "translate3d(0, 0, 0)" },
			],
			{ duration: duration * motionScale(), easing },
		);
		animation.id = FLIP_ANIMATION_ID;
	}
};

export const springAnimation = (
	element: HTMLElement,
	keyframes: Keyframe[],
	config: SpringConfig,
) => {
	if (prefersReducedMotion() || !element.animate) return undefined;
	const { easing, duration } = springEasing(config);
	return element.animate(keyframes, {
		duration: duration * motionScale(),
		easing,
		fill: "forwards",
	});
};
