import {
	KEYBOARD_INSET_EVENT,
	KEYBOARD_LIFT_ATTRIBUTE,
	KEYBOARD_LIFT_VAR,
	KEYBOARD_OFFSET_EVENT,
	KEYBOARD_PANEL_ATTRIBUTE,
	motionScale,
	prefersReducedMotion,
	SHELL_KEYBOARD_INSET_VAR,
} from "@colibri-social/ui";

export const KEYBOARD_INSET_VAR = "--keyboard-inset";
export const KEYBOARD_PROGRESS_EVENT = "colibri-keyboard-progress";
const KEYBOARD_FOLLOW_ATTRIBUTE = "data-keyboard-follow";
export const SHELL_INSET_VAR = SHELL_KEYBOARD_INSET_VAR;

const MAX_INSET_RATIO = 0.7;
const SPRING_SAMPLES = 60;
const CRITICAL_TOLERANCE = 1e-3;
const ZOOMED_SCALE = 1.01;
const FALLBACK_PANEL_RATIO = 0.4;
const MIN_PANEL_HEIGHT = 240;
const MAX_PANEL_HEIGHT = 380;
const RESERVE_RELEASE_MS = 700;
const KEYBOARD_SETTLE_MS = 120;
const KEYBOARD_STABLE_MS = 150;
const RESERVE_SPRING = { duration: 420, mass: 1, stiffness: 380 };

let rememberedKeyboard = 0;

export const keyboardPanelHeight = () => {
	if (rememberedKeyboard > 0) return rememberedKeyboard;
	const viewport = typeof window === "undefined" ? 800 : window.innerHeight;
	const max = Math.min(MAX_PANEL_HEIGHT, viewport * MAX_INSET_RATIO);
	const preferred = viewport * FALLBACK_PANEL_RATIO;
	return Math.round(Math.min(Math.max(preferred, MIN_PANEL_HEIGHT), max));
};

export type KeyboardReservation = {
	setStacked: (height: number) => void;
	release: (options?: { untilKeyboard?: boolean }) => void;
};

type ReserveController = {
	reserve: (floor: number, onReleased: () => void) => KeyboardReservation;
};

let reserveController: ReserveController | undefined;

export const reserveKeyboardSpace = (
	floor: number,
	onReleased: () => void,
): KeyboardReservation => {
	if (reserveController) return reserveController.reserve(floor, onReleased);
	return {
		setStacked: () => {},
		release: () => onReleased(),
	};
};

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
	let keyboard = 0;
	let lifted: { element: HTMLElement; inset: number } | undefined;
	let queued: number | undefined;
	let frame = 0;
	let native = false;
	let animation: Animation | undefined;
	let panelAnimations: Animation[] = [];
	let motion: Motion | undefined;
	let floor = 0;
	let stacked = 0;
	let releasing = false;
	let releaseAt: number | undefined;
	let releaseTimer: ReturnType<typeof setTimeout> | undefined;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	let rememberTimer: ReturnType<typeof setTimeout> | undefined;
	let releasedTimer: ReturnType<typeof setTimeout> | undefined;
	let onReleased: (() => void) | undefined;

	const effective = (raw: number) => {
		if (floor <= 0) return raw;
		if (releasing || stacked <= 0 || raw <= 0) return floor;
		return Math.max(raw + stacked, floor);
	};

	const valueFor = (target: Target, raw: number) => {
		return target.kind === "shell" ? effective(raw) : raw;
	};

	const noteKeyboard = (raw: number) => {
		keyboard = raw;
		if (rememberTimer) clearTimeout(rememberTimer);
		rememberTimer = undefined;
		if (raw <= 0) return;
		rememberTimer = setTimeout(() => {
			rememberTimer = undefined;
			if (keyboard === raw) rememberedKeyboard = raw;
		}, KEYBOARD_STABLE_MS);
	};

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
			root.querySelectorAll<HTMLElement>(
				`[${KEYBOARD_FOLLOW_ATTRIBUTE}], [${KEYBOARD_PANEL_ATTRIBUTE}]`,
			),
		);
	};

	const announceOffset = (movers: HTMLElement[], offset: number) => {
		for (const mover of movers)
			mover.dispatchEvent(
				new CustomEvent(KEYBOARD_OFFSET_EVENT, {
					bubbles: true,
					detail: offset,
				}),
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
		announceOffset(movers, lift);
	};

	const endMotion = () => {
		if (!motion) return;
		const { movers, target } = motion;
		for (const mover of movers) {
			if (target.kind === "lift") mover.style.translate = "";
			else mover.style.transform = "";
			mover.style.willChange = "";
		}
		motion = undefined;
		announceOffset(movers, 0);
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
			else root.toggleAttribute("data-keyboard-open", inset > 0);
			return;
		}
		const shellInset = effective(inset);
		if (shellInset < current) applyShell(shellInset);
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
		noteKeyboard(next);
		if (releasing && next > 0 && next >= floor) settleSoon();
		commit(target, valueFor(target, next));
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

	const cancelAnimations = () => {
		animation?.cancel();
		animation = undefined;
		for (const running of panelAnimations) running.cancel();
		panelAnimations = [];
	};

	const animatePanels = (
		span: number,
		samples: number[],
		spring: KeyboardSpring,
	) => {
		const last = samples.length - 1;
		const panels = root.querySelectorAll<HTMLElement>(
			`[${KEYBOARD_PANEL_ATTRIBUTE}]`,
		);
		for (const panel of panels) {
			const running = panel.animate(
				samples.map((progress, index) => ({
					offset: index / last,
					transform: `translate3d(0, ${Math.round(span * (1 - progress))}px, 0)`,
				})),
				{ duration: spring.duration, easing: "linear", fill: "none" },
			);
			running.currentTime = Math.min(
				Math.max(performance.now() - spring.at + spring.latency, 0),
				spring.duration,
			);
			panelAnimations.push(running);
		}
	};

	const animate = (target: Target, from: number, spring: KeyboardSpring) => {
		cancelAnimations();
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
			animatePanels(span, samples, spring);
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
			const raw = clampInset(detail.inset);
			noteKeyboard(raw);
			if (releasing && raw > 0)
				clearReserve(detail.duration + Math.max(detail.latency, 0));
			const next = valueFor(target, raw);
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
			const raw = clampInset(progress.to);
			keyboard = raw;
			if (releasing && raw > 0 && raw < floor) releaseAt = raw;
			const to = valueFor(target, raw);
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
		if (releaseAt !== undefined && clampInset(progress.inset) >= releaseAt) {
			releaseNow();
			return;
		}
		if (!motion) return;
		const offset = Math.min(
			Math.max(clampInset(progress.inset) - motion.base, 0),
			motion.cap,
		);
		place(motion.movers, offset, motion.target.kind);
	};

	const onFocus = (event: FocusEvent) => {
		const focused = event.target;
		if (motion || keyboard <= 0) return;
		if (!(focused instanceof HTMLElement) || !focused.matches(EDITABLE)) return;
		const element = focused.closest<HTMLElement>(
			`[${KEYBOARD_LIFT_ATTRIBUTE}]`,
		);
		if (element) {
			if (lifted?.element === element && lifted.inset === keyboard) return;
			commit({ kind: "lift", element }, keyboard);
			return;
		}
		if (focused.closest(TOP_LAYER)) return;
		if (lifted) {
			lifted.element.style.removeProperty(KEYBOARD_LIFT_VAR);
			lifted = undefined;
		}
		commit({ kind: "shell" }, effective(keyboard));
	};

	const viewport = window.visualViewport;
	const onViewport = () => {
		if (native || !viewport || viewport.scale > ZOOMED_SCALE) return;
		queue(
			clampInset(window.innerHeight - viewport.height - viewport.offsetTop),
		);
	};

	const reserveSpring = (inset: number): KeyboardSpring => {
		const reduced = prefersReducedMotion() || !(motionScale() > 0);
		const scale = reduced ? 0 : motionScale();
		return {
			inset,
			duration: RESERVE_SPRING.duration * scale,
			mass: RESERVE_SPRING.mass,
			stiffness: RESERVE_SPRING.stiffness,
			damping: 2 * Math.sqrt(RESERVE_SPRING.stiffness * RESERVE_SPRING.mass),
			velocity: 0,
			latency: 0,
			at: performance.now(),
		};
	};

	const refresh = () => {
		if (motion) return 0;
		const target = focusedTarget();
		if (target.kind !== "shell") return 0;
		const from = current;
		const next = effective(keyboard);
		if (next === from) return 0;
		cancelQueued();
		commit(target, next);
		const spring = reserveSpring(next);
		animate(target, from, spring);
		return spring.duration;
	};

	const settleRelease = (duration: number) => {
		const done = onReleased;
		onReleased = undefined;
		if (releasedTimer) clearTimeout(releasedTimer);
		releasedTimer = undefined;
		if (!done) return;
		if (duration <= 0) {
			done();
			return;
		}
		releasedTimer = setTimeout(() => {
			releasedTimer = undefined;
			done();
		}, duration);
	};

	const dropReserve = () => {
		floor = 0;
		stacked = 0;
		releasing = false;
		releaseAt = undefined;
		if (releaseTimer) clearTimeout(releaseTimer);
		releaseTimer = undefined;
		if (settleTimer) clearTimeout(settleTimer);
		settleTimer = undefined;
	};

	const clearReserve = (cover: number) => {
		dropReserve();
		settleRelease(cover);
	};

	const releaseNow = () => {
		dropReserve();
		endMotion();
		settleRelease(refresh());
	};

	const settleSoon = () => {
		if (settleTimer) clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			settleTimer = undefined;
			if (releasing) releaseNow();
		}, KEYBOARD_SETTLE_MS);
	};

	const reserve = (
		nextFloor: number,
		released: () => void,
	): KeyboardReservation => {
		const previous = onReleased;
		onReleased = undefined;
		if (releaseTimer) clearTimeout(releaseTimer);
		if (releasedTimer) clearTimeout(releasedTimer);
		releaseTimer = undefined;
		releasedTimer = undefined;
		if (previous && previous !== released) previous();
		floor = Math.max(0, nextFloor);
		stacked = 0;
		releasing = false;
		releaseAt = undefined;
		onReleased = released;
		refresh();
		const owns = () => onReleased === released;
		return {
			setStacked: (height) => {
				if (!owns() || releasing) return;
				stacked = Math.max(0, height);
				refresh();
			},
			release: (options) => {
				if (!owns() || releasing) return;
				if (options?.untilKeyboard) {
					releasing = true;
					stacked = 0;
					releaseTimer = setTimeout(() => {
						releaseTimer = undefined;
						if (releasing) releaseNow();
					}, RESERVE_RELEASE_MS);
					return;
				}
				releaseNow();
			},
		};
	};

	const controller: ReserveController = { reserve };
	reserveController = controller;

	window.addEventListener(KEYBOARD_INSET_EVENT, onInset);
	window.addEventListener(KEYBOARD_PROGRESS_EVENT, onProgress);
	viewport?.addEventListener("resize", onViewport);
	document.addEventListener("focusin", onFocus);

	return () => {
		window.removeEventListener(KEYBOARD_INSET_EVENT, onInset);
		window.removeEventListener(KEYBOARD_PROGRESS_EVENT, onProgress);
		document.removeEventListener("focusin", onFocus);
		endMotion();
		viewport?.removeEventListener("resize", onViewport);
		if (frame) cancelAnimationFrame(frame);
		cancelAnimations();
		if (reserveController === controller) reserveController = undefined;
		if (releaseTimer) clearTimeout(releaseTimer);
		if (releasedTimer) clearTimeout(releasedTimer);
		if (settleTimer) clearTimeout(settleTimer);
		if (rememberTimer) clearTimeout(rememberTimer);
		const released = onReleased;
		onReleased = undefined;
		released?.();
		lifted?.element.style.removeProperty(KEYBOARD_LIFT_VAR);
		lifted = undefined;
		root.style.removeProperty(KEYBOARD_INSET_VAR);
		root.style.removeProperty(SHELL_INSET_VAR);
		root.removeAttribute("data-keyboard-open");
	};
};
