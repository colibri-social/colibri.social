import { onCleanup } from "solid-js";
import { prefersReducedMotion } from "./motion";

const SETTLE_SLACK_MS = 120;
const WATCHED_ATTRIBUTES = ["class", "hidden", "style"];
const OWN_ATTRIBUTES = new Set(["style", "data-height-transition"]);

export type HeightTransitionOptions = {
	isBusy?: () => boolean;
};

export const attachHeightTransition = (
	element: HTMLElement,
	options: HeightTransitionOptions = {},
) => {
	let settled = element.offsetHeight;
	let animating = false;
	let armed = false;
	let armFrame: number | undefined;

	const scheduleArm = () => {
		if (armFrame !== undefined) cancelAnimationFrame(armFrame);
		armFrame = requestAnimationFrame(() => {
			armFrame = requestAnimationFrame(() => {
				armFrame = undefined;
				settled = element.offsetHeight;
				armed = true;
			});
		});
	};
	let fallback: ReturnType<typeof setTimeout> | undefined;
	let cancelRun: (() => void) | undefined;

	const measure = () => element.offsetHeight;

	const clear = () => {
		element.style.removeProperty("height");
		element.style.removeProperty("overflow");
		element.removeAttribute("data-height-transition");
	};

	const run = (from: number, to: number) => {
		animating = true;
		element.style.height = `${from}px`;
		element.style.overflow = "clip";
		void element.offsetHeight;
		element.setAttribute("data-height-transition", "");
		element.style.height = `${to}px`;

		const durations = getComputedStyle(element)
			.transitionDuration.split(",")
			.map((value) => Number.parseFloat(value) * 1000);
		const duration = Math.max(0, ...durations.filter(Number.isFinite));

		const onEnd = (event: TransitionEvent) => {
			if (event.target !== element || event.propertyName !== "height") return;
			finish();
		};

		const stop = () => {
			element.removeEventListener("transitionend", onEnd);
			clearTimeout(fallback);
			fallback = undefined;
			cancelRun = undefined;
			clear();
		};

		const finish = () => {
			stop();
			const natural = measure();
			const chain =
				Math.abs(natural - to) >= 0.5 &&
				!prefersReducedMotion() &&
				!options.isBusy?.();
			if (chain) {
				run(to, natural);
				return;
			}
			settled = natural;
			animating = false;
		};

		cancelRun = stop;
		element.addEventListener("transitionend", onEnd);
		fallback = setTimeout(finish, duration + SETTLE_SLACK_MS);
	};

	const onContentChange = (records: MutationRecord[]) => {
		if (!armed) {
			settled = measure();
			scheduleArm();
			return;
		}
		if (animating) return;
		const external = records.some(
			(record) =>
				!(
					record.target === element &&
					OWN_ATTRIBUTES.has(record.attributeName ?? "")
				),
		);
		if (!external) return;
		const next = measure();
		const skip =
			Math.abs(next - settled) < 0.5 ||
			prefersReducedMotion() ||
			options.isBusy?.();
		if (skip) {
			settled = next;
			return;
		}
		run(settled, next);
	};

	const mutations = new MutationObserver(onContentChange);
	mutations.observe(element, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true,
		attributeFilter: WATCHED_ATTRIBUTES,
	});

	const sizes = new ResizeObserver(() => {
		if (!animating) settled = measure();
	});
	sizes.observe(element);
	scheduleArm();

	return () => {
		mutations.disconnect();
		sizes.disconnect();
		if (armFrame !== undefined) cancelAnimationFrame(armFrame);
		cancelRun?.();
		animating = false;
	};
};

export const createHeightTransition = (
	options: HeightTransitionOptions = {},
) => {
	let dispose: (() => void) | undefined;
	onCleanup(() => dispose?.());
	return (element: HTMLElement) => {
		dispose?.();
		dispose = attachHeightTransition(element, options);
	};
};
