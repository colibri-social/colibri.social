import { KEYBOARD_INSET_EVENT } from "@colibri-social/ui";

export const KEYBOARD_INSET_VAR = "--keyboard-inset";

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

const clampInset = (value: number) =>
	Math.min(Math.max(value, 0), window.innerHeight * MAX_INSET_RATIO);

const shellHeight = (inset: number) => `calc(100dvh - ${inset}px)`;

export type KeyboardInsetOptions = {
	shell: () => HTMLElement | undefined;
	root?: HTMLElement;
};

export const installKeyboardInset = (options: KeyboardInsetOptions) => {
	const root = options.root ?? document.documentElement;
	let current = 0;
	let queued: number | undefined;
	let frame = 0;
	let native = false;
	let animation: Animation | undefined;

	const apply = (inset: number) => {
		current = inset;
		root.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
		root.toggleAttribute("data-keyboard-open", inset > 0);
	};

	const flush = () => {
		frame = 0;
		const next = queued;
		queued = undefined;
		if (next !== undefined && next !== current) apply(next);
	};

	const queue = (inset: number) => {
		queued = inset;
		if (!frame) frame = requestAnimationFrame(flush);
	};

	const animate = (from: number, spring: KeyboardSpring) => {
		const shell = options.shell();
		animation?.cancel();
		animation = undefined;
		if (!shell || spring.duration <= 0 || spring.mass <= 0) return;
		const to = clampInset(spring.inset);
		const span = to - from;
		const samples = springSamples(spring);
		const last = samples.length - 1;
		const frames = samples.map((progress, index) => ({
			offset: index / last,
			height: shellHeight(from + span * progress),
		}));
		const running = shell.animate(frames, {
			duration: spring.duration,
			easing: "linear",
			fill: "none",
		});
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
			const next = clampInset(detail.inset);
			if (next === current) return;
			const from = current;
			if (frame) cancelAnimationFrame(frame);
			frame = 0;
			queued = undefined;
			apply(next);
			animate(from, detail);
			return;
		}
		const reported = typeof detail === "number" ? detail : Number(detail);
		if (!Number.isFinite(reported)) return;
		queue(clampInset(reported));
	};

	const viewport = window.visualViewport;
	const onViewport = () => {
		if (native || !viewport || viewport.scale > ZOOMED_SCALE) return;
		queue(
			clampInset(window.innerHeight - viewport.height - viewport.offsetTop),
		);
	};

	window.addEventListener(KEYBOARD_INSET_EVENT, onInset);
	viewport?.addEventListener("resize", onViewport);

	return () => {
		window.removeEventListener(KEYBOARD_INSET_EVENT, onInset);
		viewport?.removeEventListener("resize", onViewport);
		if (frame) cancelAnimationFrame(frame);
		animation?.cancel();
		root.style.removeProperty(KEYBOARD_INSET_VAR);
		root.removeAttribute("data-keyboard-open");
	};
};
