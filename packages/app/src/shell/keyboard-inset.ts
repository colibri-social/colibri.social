import {
	KEYBOARD_INSET_EVENT,
	KEYBOARD_LIFT_ATTRIBUTE,
	KEYBOARD_LIFT_VAR,
} from "@colibri-social/ui";

export const KEYBOARD_INSET_VAR = "--keyboard-inset";
export const KEYBOARD_PROGRESS_EVENT = "colibri-keyboard-progress";
export const KEYBOARD_FOLLOW_ATTRIBUTE = "data-keyboard-follow";
export const SHELL_INSET_VAR = "--shell-keyboard-inset";

const MAX_INSET_RATIO = 0.7;
const SPRING_SAMPLES = 60;
const CRITICAL_TOLERANCE = 1e-3;
const ZOOMED_SCALE = 1.01;

export type KeyboardSpring = {
	inset: number;
	duration: number;
	mass: number;
	stiffness: number;
	damping: number;
	velocity: number;
	latency: number;
	at: number;
};

const isSpring = (value: unknown): value is KeyboardSpring =>
	!!value &&
	typeof value === "object" &&
	typeof (value as KeyboardSpring).inset === "number" &&
	typeof (value as KeyboardSpring).duration === "number";

const springProgress = (
	omega: number,
	zeta: number,
	velocity: number,
	t: number,
) => {
	if (t <= 0) return 0;
	if (zeta < 1 - CRITICAL_TOLERANCE) {
		const damped = omega * Math.sqrt(1 - zeta * zeta);
		const decay = Math.exp(-zeta * omega * t);
		return (
			1 -
			decay *
				(Math.cos(damped * t) +
					((zeta * omega - velocity) / damped) * Math.sin(damped * t))
		);
	}
	if (zeta <= 1 + CRITICAL_TOLERANCE) {
		return 1 - Math.exp(-omega * t) * (1 + (omega - velocity) * t);
	}
	const spread = omega * Math.sqrt(zeta * zeta - 1);
	const fast = -omega * zeta - spread;
	const slow = -omega * zeta + spread;
	const slowWeight = (-velocity - fast) / (slow - fast);
	return (
		1 -
		(slowWeight * Math.exp(slow * t) + (1 - slowWeight) * Math.exp(fast * t))
	);
};

export const springSamples = (spring: KeyboardSpring): number[] => {
	const omega = Math.sqrt(spring.stiffness / spring.mass);
	const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
	const seconds = spring.duration / 1000;
	const samples: number[] = [];
	for (let index = 0; index < SPRING_SAMPLES; index++) {
		const t = (seconds * index) / (SPRING_SAMPLES - 1);
		samples.push(springProgress(omega, zeta, spring.velocity, t));
	}
	samples[SPRING_SAMPLES - 1] = 1;
	return samples;
};

type KeyboardProgress =
	| { phase: "start"; from: number; to: number }
	| { phase: "progress"; inset: number };

export const readProgress = (value: unknown): KeyboardProgress | undefined => {
	if (!value || typeof value !== "object") return undefined;
	const detail = value as Record<string, unknown>;
	if (
		detail.phase === "start" &&
		typeof detail.from === "number" &&
		typeof detail.to === "number"
	)
		return { phase: "start", from: detail.from, to: detail.to };
	if (detail.phase === "progress" && typeof detail.inset === "number")
		return { phase: "progress", inset: detail.inset };
	return undefined;
};

const clampInset = (value: number) =>
	Math.min(Math.max(value, 0), window.innerHeight * MAX_INSET_RATIO);

const shellHeight = (inset: number) => `calc(100dvh - ${inset}px)`;

export type KeyboardInsetOptions = {
	shell: () => HTMLElement | undefined;
	root?: HTMLElement;
};

const EDITABLE =
	"textarea, [contenteditable]:not([contenteditable='false']), input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']):not([type='image']):not([type='hidden'])";

const TOP_LAYER = "[data-kb-top-layer], [role='dialog']";

type Target =
	| { kind: "shell" }
	| { kind: "lift"; element: HTMLElement }
	| { kind: "overlay" };

type Motion = {
	target: Target;
	base: number;
	cap: number;
	movers: HTMLElement[];
};

export const installKeyboardInset = (options: KeyboardInsetOptions) => {
	const root = options.root ?? document.documentElement;
	let current = 0;
	let lifted: { element: HTMLElement; inset: number } | undefined;
	let queued: number | undefined;
	let frame = 0;
	let native = false;
	let animation: Animation | undefined;
	let motion: Motion | undefined;

	const focusedTarget = (): Target => {
		const active = document.activeElement;
		if (active instanceof HTMLElement && active.matches(EDITABLE)) {
			const element = active.closest<HTMLElement>(
				`[${KEYBOARD_LIFT_ATTRIBUTE}]`,
			);
			if (element) return { kind: "lift", element };
			if (active.closest(TOP_LAYER)) return { kind: "overlay" };
		}
		if (lifted?.element.isConnected && lifted.inset > 0)
			return { kind: "lift", element: lifted.element };
		return { kind: "shell" };
	};

	const committedFor = (target: Target) => {
		if (target.kind === "shell") return current;
		if (target.kind === "lift" && lifted?.element === target.element)
			return lifted.inset;
		return 0;
	};

	const headroom = (element: HTMLElement) => {
		const overlayTop =
			Number.parseFloat(
				getComputedStyle(root).getPropertyValue("--overlay-top"),
			) || 0;
		return Math.max(0, element.getBoundingClientRect().top - overlayTop);
	};

	const moversFor = (target: Target) => {
		if (target.kind === "lift") return [target.element];
		if (target.kind === "overlay") return [];
		return Array.from(
			root.querySelectorAll<HTMLElement>(`[${KEYBOARD_FOLLOW_ATTRIBUTE}]`),
		);
	};

	const place = (
		movers: HTMLElement[],
		offset: number,
		kind: Target["kind"],
	) => {
		const lift = Math.round(offset);
		for (const mover of movers) {
			if (kind === "lift") mover.style.translate = lift ? `0 ${-lift}px` : "";
			else mover.style.transform = lift ? `translate3d(0, ${-lift}px, 0)` : "";
		}
	};

	const endMotion = () => {
		if (!motion) return;
		for (const mover of motion.movers) {
			if (motion.target.kind === "lift") mover.style.translate = "";
			else mover.style.transform = "";
			mover.style.willChange = "";
		}
		motion = undefined;
	};

	const applyShell = (inset: number) => {
		current = inset;
		root.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
		root.style.setProperty(SHELL_INSET_VAR, `${inset}px`);
		root.toggleAttribute("data-keyboard-open", inset > 0);
	};

	const applyLift = (element: HTMLElement, inset: number) => {
		if (lifted && lifted.element !== element)
			lifted.element.style.removeProperty(KEYBOARD_LIFT_VAR);
		if (inset > 0) {
			element.style.setProperty(KEYBOARD_LIFT_VAR, `${inset}px`);
			lifted = { element, inset };
		} else {
			element.style.removeProperty(KEYBOARD_LIFT_VAR);
			lifted = undefined;
		}
		root.toggleAttribute("data-keyboard-open", inset > 0);
	};

	const revealFocus = () => {
		const active = document.activeElement;
		if (active instanceof HTMLElement && active.matches(EDITABLE))
			active.scrollIntoView({ block: "nearest" });
	};

	const commit = (target: Target, inset: number) => {
		if (target.kind === "shell") {
			if (inset !== current) applyShell(inset);
			return;
		}
		if (inset < current) applyShell(inset);
		if (target.kind === "lift") {
			applyLift(target.element, inset);
			if (inset > 0) requestAnimationFrame(revealFocus);
			return;
		}
		root.toggleAttribute("data-keyboard-open", inset > 0);
	};

	const flush = () => {
		frame = 0;
		const next = queued;
		queued = undefined;
		if (next === undefined) return;
		const target = motion?.target ?? focusedTarget();
		endMotion();
		commit(target, next);
	};

	const queue = (inset: number) => {
		queued = inset;
		if (!frame) frame = requestAnimationFrame(flush);
	};

	const cancelQueued = () => {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		queued = undefined;
	};

	const animate = (target: Target, from: number, spring: KeyboardSpring) => {
		animation?.cancel();
		animation = undefined;
		if (spring.duration <= 0 || spring.mass <= 0) return;
		const to = clampInset(spring.inset);
		const span = to - from;
		const samples = springSamples(spring);
		const last = samples.length - 1;
		let running: Animation | undefined;
		if (target.kind === "shell") {
			const shell = options.shell();
			if (!shell) return;
			running = shell.animate(
				samples.map((progress, index) => ({
					offset: index / last,
					height: shellHeight(from + span * progress),
				})),
				{ duration: spring.duration, easing: "linear", fill: "none" },
			);
		} else if (target.kind === "lift") {
			running = target.element.animate(
				samples.map((progress, index) => ({
					offset: index / last,
					translate: `0 ${Math.round(span * (1 - progress))}px`,
				})),
				{ duration: spring.duration, easing: "linear", fill: "none" },
			);
		}
		if (!running) return;
		running.currentTime = Math.min(
			Math.max(performance.now() - spring.at + spring.latency, 0),
			spring.duration,
		);
		animation = running;
	};

	const onInset = (event: Event) => {
		native = true;
		const detail = (event as CustomEvent<unknown>).detail;
		if (isSpring(detail)) {
			const target = focusedTarget();
			const next = clampInset(detail.inset);
			const from = committedFor(target);
			if (next === from) return;
			cancelQueued();
			endMotion();
			commit(target, next);
			animate(target, from, detail);
			return;
		}
		const reported = typeof detail === "number" ? detail : Number(detail);
		if (!Number.isFinite(reported)) return;
		queue(clampInset(reported));
	};

	const onProgress = (event: Event) => {
		native = true;
		const progress = readProgress((event as CustomEvent<unknown>).detail);
		if (!progress) return;
		if (progress.phase === "start") {
			cancelQueued();
			endMotion();
			const target = focusedTarget();
			const from = committedFor(target);
			const to = clampInset(progress.to);
			const base = Math.min(from, to);
			const movers = moversFor(target);
			for (const mover of movers)
				mover.style.willChange =
					target.kind === "lift" ? "translate" : "transform";
			commit(target, base);
			let cap = Math.max(from, to) - base;
			if (target.kind === "lift") cap = Math.min(cap, headroom(target.element));
			motion = { target, base, cap, movers };
			place(movers, Math.min(from - base, cap), target.kind);
			return;
		}
		if (!motion) return;
		const offset = Math.min(
			Math.max(clampInset(progress.inset) - motion.base, 0),
			motion.cap,
		);
		place(motion.movers, offset, motion.target.kind);
	};

	const viewport = window.visualViewport;
	const onViewport = () => {
		if (native || !viewport || viewport.scale > ZOOMED_SCALE) return;
		queue(
			clampInset(window.innerHeight - viewport.height - viewport.offsetTop),
		);
	};

	window.addEventListener(KEYBOARD_INSET_EVENT, onInset);
	window.addEventListener(KEYBOARD_PROGRESS_EVENT, onProgress);
	viewport?.addEventListener("resize", onViewport);

	return () => {
		window.removeEventListener(KEYBOARD_INSET_EVENT, onInset);
		window.removeEventListener(KEYBOARD_PROGRESS_EVENT, onProgress);
		endMotion();
		viewport?.removeEventListener("resize", onViewport);
		if (frame) cancelAnimationFrame(frame);
		animation?.cancel();
		lifted?.element.style.removeProperty(KEYBOARD_LIFT_VAR);
		lifted = undefined;
		root.style.removeProperty(KEYBOARD_INSET_VAR);
		root.style.removeProperty(SHELL_INSET_VAR);
		root.removeAttribute("data-keyboard-open");
	};
};
