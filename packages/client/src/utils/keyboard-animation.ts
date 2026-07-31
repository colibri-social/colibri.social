import type { KeyboardTransition } from "./visual-viewport";

export const animateKeyboardTransition = (
	el: HTMLElement,
	transition: KeyboardTransition,
	frameFor: (inset: number) => Keyframe,
): Animation | undefined => {
	if (transition.samples.length < 2) return undefined;

	const span = transition.toInset - transition.fromInset;
	const last = transition.samples.length - 1;
	const frames = transition.samples.map((progress, index) => ({
		offset: index / last,
		...frameFor(transition.fromInset + span * progress),
	}));

	const animation = el.animate(frames, {
		duration: transition.durationMs,
		easing: "linear",
		fill: "none",
	});

	animation.currentTime = Math.min(
		Math.max(
			performance.now() - transition.receivedAt + transition.latencyMs,
			0,
		),
		transition.durationMs,
	);

	return animation;
};
