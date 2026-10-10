import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
} from "solid-js";

const transitioning = (element: Element) =>
	element
		.getAnimations()
		.some((animation) => animation.playState === "running");

export const createExitHold = <T>(
	value: Accessor<T>,
	open: Accessor<boolean>,
) => {
	const [present, setPresent] = createSignal(false);
	const held = createMemo<T>(
		(previous) => (open() || !present() ? value() : previous),
		value(),
	);
	const track = () => {
		setPresent(true);
		onCleanup(() => setPresent(false));
	};
	const Marker = () => {
		track();
		return null;
	};
	const settle = (element: HTMLElement) => {
		const release = () => {
			if (!open() && !transitioning(element)) setPresent(false);
		};
		const onTransitionDone = (event: TransitionEvent) => {
			if (event.target === element) release();
		};
		let frame = 0;
		createEffect(() => {
			cancelAnimationFrame(frame);
			if (open()) {
				setPresent(true);
				return;
			}
			frame = requestAnimationFrame(release);
		});
		element.addEventListener("transitionend", onTransitionDone);
		element.addEventListener("transitioncancel", onTransitionDone);
		onCleanup(() => {
			cancelAnimationFrame(frame);
			element.removeEventListener("transitionend", onTransitionDone);
			element.removeEventListener("transitioncancel", onTransitionDone);
			setPresent(false);
		});
	};
	return { value: held, track, Marker, settle };
};
