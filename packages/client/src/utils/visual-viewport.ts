import { type Accessor, createSignal, onCleanup } from "solid-js";

export type KeyboardTransition = {
	fromInset: number;
	toInset: number;
	durationMs: number;
	samples: number[];
	receivedAt: number;
	latencyMs: number;
};

export type ViewportMetrics = {
	height: Accessor<number | undefined>;
	offsetTop: Accessor<number>;
	keyboardInset: Accessor<number>;
	keyboardAnimating: Accessor<boolean>;
	keyboardTransition: Accessor<KeyboardTransition | undefined>;
};

type KeyboardInsetDetail = {
	inset: number;
	duration: number;
	mass: number;
	stiffness: number;
	damping: number;
	velocity: number;
	latency: number;
	at: number;
};

const SPRING_SAMPLE_COUNT = 60;
const SETTLE_GRACE_MS = 60;
const ANIMATION_QUIET_MS = 120;
const CRITICAL_DAMPING_TOLERANCE = 1e-3;

export const shellHeightForInset = (inset: number): number =>
	Math.max(window.innerHeight - inset, window.innerHeight * 0.3);

const springProgress = (
	omega0: number,
	zeta: number,
	velocity: number,
	t: number,
): number => {
	if (t <= 0) return 0;

	if (zeta < 1 - CRITICAL_DAMPING_TOLERANCE) {
		const damped = omega0 * Math.sqrt(1 - zeta * zeta);
		const decay = Math.exp(-zeta * omega0 * t);
		return (
			1 -
			decay *
				(Math.cos(damped * t) +
					((zeta * omega0 - velocity) / damped) * Math.sin(damped * t))
		);
	}

	if (zeta <= 1 + CRITICAL_DAMPING_TOLERANCE) {
		return 1 - Math.exp(-omega0 * t) * (1 + (omega0 - velocity) * t);
	}

	const spread = omega0 * Math.sqrt(zeta * zeta - 1);
	const fast = -omega0 * zeta - spread;
	const slow = -omega0 * zeta + spread;
	const slowWeight = (-velocity - fast) / (slow - fast);
	return (
		1 -
		(slowWeight * Math.exp(slow * t) + (1 - slowWeight) * Math.exp(fast * t))
	);
};

const springSamples = (detail: KeyboardInsetDetail): number[] => {
	const omega0 = Math.sqrt(detail.stiffness / detail.mass);
	const zeta = detail.damping / (2 * Math.sqrt(detail.stiffness * detail.mass));
	const seconds = detail.duration / 1000;
	const samples: number[] = [];

	for (let index = 0; index < SPRING_SAMPLE_COUNT; index++) {
		const t = (seconds * index) / (SPRING_SAMPLE_COUNT - 1);
		samples.push(springProgress(omega0, zeta, detail.velocity, t));
	}

	return samples;
};

/**
 * Tracks the VisualViewport so the app shell can be sized to the area the user
 * can actually see.
 */
export const createViewportMetrics = (): ViewportMetrics => {
	const [vvHeight, setVvHeight] = createSignal<number | undefined>();
	const [offsetTop, setOffsetTop] = createSignal(0);
	const [keyboardInset, setKeyboardInset] = createSignal(0);
	const [keyboardAnimating, setKeyboardAnimating] = createSignal(false);
	const [keyboardTransition, setKeyboardTransition] =
		createSignal<KeyboardTransition>();

	let hasNativeKeyboardInset = false;

	const height = () => {
		const inset = keyboardInset();
		return hasNativeKeyboardInset ? shellHeightForInset(inset) : vvHeight();
	};

	if (typeof window !== "undefined") {
		let settleTimer: number | undefined;

		const settle = () => {
			if (settleTimer !== undefined) clearTimeout(settleTimer);
			settleTimer = undefined;
			setKeyboardAnimating(false);
		};

		const onKeyboardInset = (event: Event) => {
			hasNativeKeyboardInset = true;
			const raw = (event as CustomEvent<number | KeyboardInsetDetail>).detail;
			const detail = typeof raw === "object" && raw !== null ? raw : undefined;
			const reported = detail ? detail.inset : (raw as number | undefined);
			const clamped = Math.min(
				Math.max(reported ?? 0, 0),
				window.innerHeight * 0.7,
			);

			const previous = keyboardInset();
			if (clamped === previous) return;

			if (detail && detail.duration > 0 && detail.mass > 0) {
				setKeyboardTransition({
					fromInset: previous,
					toInset: clamped,
					durationMs: detail.duration,
					samples: springSamples(detail),
					receivedAt: detail.at,
					latencyMs: detail.latency,
				});
				setKeyboardAnimating(true);
				if (settleTimer !== undefined) clearTimeout(settleTimer);
				settleTimer = window.setTimeout(
					settle,
					detail.duration + SETTLE_GRACE_MS,
				);
			} else {
				setKeyboardAnimating(true);
				if (settleTimer !== undefined) clearTimeout(settleTimer);
				settleTimer = window.setTimeout(settle, ANIMATION_QUIET_MS);
			}

			setKeyboardInset(clamped);
		};

		window.addEventListener("colibri-keyboard-inset", onKeyboardInset);
		onCleanup(() => {
			window.removeEventListener("colibri-keyboard-inset", onKeyboardInset);
			if (settleTimer !== undefined) clearTimeout(settleTimer);
		});
	}

	const metrics = {
		height,
		offsetTop,
		keyboardInset,
		keyboardAnimating,
		keyboardTransition,
	};

	const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
	if (!vv) return metrics;

	const update = () => {
		setVvHeight(vv.height);
		setOffsetTop(vv.offsetTop);
	};

	update();
	vv.addEventListener("resize", update);
	vv.addEventListener("scroll", update);

	let rafId: number | undefined;
	let rafCount = 0;
	const recheck = () => {
		update();
		rafCount += 1;
		if (rafCount < 10) rafId = requestAnimationFrame(recheck);
	};
	rafId = requestAnimationFrame(recheck);

	const onVisibility = () => {
		if (document.visibilityState === "visible") update();
	};
	document.addEventListener("visibilitychange", onVisibility);

	onCleanup(() => {
		vv.removeEventListener("resize", update);
		vv.removeEventListener("scroll", update);
		document.removeEventListener("visibilitychange", onVisibility);
		if (rafId !== undefined) cancelAnimationFrame(rafId);
	});

	return metrics;
};
