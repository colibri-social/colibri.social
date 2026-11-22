import type { JSX } from "solid-js";
import { prefersReducedMotion } from "./motion";

export type IconEffect =
	| "bounce"
	| "pop"
	| "hop"
	| "nudge"
	| "wiggle"
	| "spin"
	| "tilt"
	| "shake"
	| "pulse";

export type IconEffectOptions = {
	effect: IconEffect;
	origin?: string;
	trigger?: "hover" | "press";
	vars?: Record<`--fx-${string}`, string>;
};

const PLAY_ATTRIBUTE = "data-icon-fx-play";

export const iconEffectClass = (
	effect: IconEffect,
	trigger?: "hover" | "press",
) => `icon-fx icon-fx-${effect}${trigger === "press" ? " icon-fx-press" : ""}`;

export const iconEffectStyle = (
	options: Pick<IconEffectOptions, "origin" | "vars">,
): JSX.CSSProperties => ({
	...(options.origin ? { "--icon-origin": options.origin } : {}),
	...(options.vars ?? {}),
});

export const iconEffect = (options: IconEffectOptions) => ({
	class: iconEffectClass(options.effect, options.trigger),
	style: iconEffectStyle(options),
});

export const playIconEffect = async (element: Element) => {
	if (prefersReducedMotion()) return;
	element.removeAttribute(PLAY_ATTRIBUTE);
	void (element as HTMLElement).getBoundingClientRect?.();
	element.setAttribute(PLAY_ATTRIBUTE, "");
	const running = element.getAnimations({ subtree: true });
	await Promise.allSettled(running.map((animation) => animation.finished));
	element.removeAttribute(PLAY_ATTRIBUTE);
};

const effectTargets = (host: Element, pressOnly: boolean) => {
	const targets = host.matches(".icon-fx")
		? [host]
		: [...host.querySelectorAll(".icon-fx")];
	return targets.filter(
		(target) => target.classList.contains("icon-fx-press") === pressOnly,
	);
};

const hostOf = (target: EventTarget | null) => {
	if (!(target instanceof Element)) return null;
	return target.closest("[data-icon-host]") ?? target.closest(".icon-fx");
};

let installed = false;

export const installIconEffects = () => {
	if (installed || typeof document === "undefined") return;
	installed = true;

	document.addEventListener(
		"pointerover",
		(event) => {
			if (event.pointerType !== "mouse") return;
			const host = hostOf(event.target);
			if (!host) return;
			const from = event.relatedTarget;
			if (from instanceof Node && host.contains(from)) return;
			for (const target of effectTargets(host, false))
				void playIconEffect(target);
		},
		{ capture: true, passive: true },
	);

	document.addEventListener(
		"pointerdown",
		(event) => {
			const host = hostOf(event.target);
			if (!host) return;
			for (const target of effectTargets(host, true))
				void playIconEffect(target);
			if (event.pointerType !== "mouse") {
				for (const target of effectTargets(host, false))
					void playIconEffect(target);
			}
		},
		{ capture: true, passive: true },
	);
};
