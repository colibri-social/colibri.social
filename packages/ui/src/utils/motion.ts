export type SpringConfig = {
	stiffness: number;
	damping: number;
	mass?: number;
};

export const springs = {
	toggle: { stiffness: 520, damping: 34 },
	thumbStretch: { stiffness: 600, damping: 40 },
	pop: { stiffness: 500, damping: 27 },
	overlayIn: { stiffness: 420, damping: 32 },
	sheet: { stiffness: 340, damping: 34 },
} satisfies Record<string, SpringConfig>;

const SETTLE_EPSILON = 0.002;
const STEP_MS = 1000 / 240;
const MAX_DURATION_MS = 3000;

export const simulateSpring = (
	config: SpringConfig,
	initialVelocity = 0,
): number[] => {
	const mass = config.mass ?? 1;
	const dt = STEP_MS / 1000;
	let position = 0;
	let velocity = initialVelocity;
	const samples = [0];

	for (let elapsed = 0; elapsed < MAX_DURATION_MS; elapsed += STEP_MS) {
		const force =
			-config.stiffness * (position - 1) - config.damping * velocity;
		velocity += (force / mass) * dt;
		position += velocity * dt;
		samples.push(position);

		const settled =
			Math.abs(position - 1) < SETTLE_EPSILON &&
			Math.abs(velocity) < SETTLE_EPSILON * 20;
		if (settled) break;
	}

	samples[samples.length - 1] = 1;
	return samples;
};

export type SpringEasing = {
	easing: string;
	duration: number;
};

const easingCache = new Map<string, SpringEasing>();

export const springEasing = (config: SpringConfig): SpringEasing => {
	const key = `${config.stiffness}:${config.damping}:${config.mass ?? 1}`;
	const cached = easingCache.get(key);
	if (cached) return cached;

	const samples = simulateSpring(config);
	const duration = Math.round((samples.length - 1) * STEP_MS);
	const pointCount = Math.min(64, samples.length);
	const points: string[] = [];

	for (let index = 0; index < pointCount; index++) {
		const sampleIndex = Math.round(
			(index / (pointCount - 1)) * (samples.length - 1),
		);
		points.push(samples[sampleIndex].toFixed(4));
	}

	const result = { easing: `linear(${points.join(", ")})`, duration };
	easingCache.set(key, result);
	return result;
};

const MOTION_TOKENS_ID = "colibri-ui-motion-tokens";

export const motionTokensCss = () => {
	const lines = Object.entries(springs).map(([name, config]) => {
		const { easing, duration } = springEasing(config);
		const token = name.replace(
			/[A-Z]/g,
			(letter) => `-${letter.toLowerCase()}`,
		);
		return `--ease-${token}: ${easing}; --duration-${token}: ${duration}ms;`;
	});
	return `:root { ${lines.join(" ")} }`;
};

export const installMotionTokens = () => {
	if (typeof document === "undefined") return;
	if (document.getElementById(MOTION_TOKENS_ID)) return;
	const style = document.createElement("style");
	style.id = MOTION_TOKENS_ID;
	style.textContent = motionTokensCss();
	document.head.append(style);
};

const rootDataset = () =>
	typeof document === "undefined"
		? undefined
		: document.documentElement.dataset;

export const motionScale = () => (rootDataset()?.slowMotion === "true" ? 5 : 1);

export const prefersReducedMotion = () => {
	if (rootDataset()?.reducedMotion === "true") return true;
	if (typeof window === "undefined" || !window.matchMedia) return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const springTransition = (
	property: string | string[],
	config: SpringConfig,
) => {
	const { easing, duration } = springEasing(config);
	const scaled = duration * motionScale();
	return (Array.isArray(property) ? property : [property])
		.map((name) => `${name} ${scaled}ms ${easing}`)
		.join(", ");
};

export const playKeyframes = (
	element: Element | undefined,
	keyframes: Keyframe[],
	options: {
		duration: number;
		easing?: string;
		delay?: number;
		fill?: FillMode;
	},
) => {
	if (!element || prefersReducedMotion() || !element.animate) return;
	element.getAnimations().forEach((animation) => {
		animation.cancel();
	});
	return element.animate(keyframes, {
		...options,
		duration: options.duration * motionScale(),
		delay: (options.delay ?? 0) * motionScale(),
	});
};

export const popKeyframes: Keyframe[] = [
	{ transform: "scale(1)" },
	{ transform: "scale(1.08)", offset: 0.4 },
	{ transform: "scale(1)" },
];

export type SpringHandle = {
	stop: () => void;
	finished: Promise<void>;
};

export const animateSpring = (options: {
	from: number;
	to: number;
	config: SpringConfig;
	velocity?: number;
	onUpdate: (value: number) => void;
}): SpringHandle => {
	const { from, to, config, onUpdate } = options;

	if (prefersReducedMotion() || from === to) {
		onUpdate(to);
		return { stop: () => {}, finished: Promise.resolve() };
	}

	const mass = config.mass ?? 1;
	let position = from;
	let velocity = options.velocity ?? 0;
	let frame = 0;
	let last = 0;
	let resolve = () => {};
	const finished = new Promise<void>((done) => {
		resolve = done;
	});

	const tick = (now: number) => {
		const elapsed = last === 0 ? STEP_MS : now - last;
		last = now;
		const steps = Math.max(1, Math.round(elapsed / motionScale() / STEP_MS));
		const dt = STEP_MS / 1000;

		for (let step = 0; step < steps; step++) {
			const force =
				-config.stiffness * (position - to) - config.damping * velocity;
			velocity += (force / mass) * dt;
			position += velocity * dt;
		}

		const range = Math.max(Math.abs(to - from), 1);
		const settled =
			Math.abs(position - to) / range < SETTLE_EPSILON &&
			Math.abs(velocity) / range < SETTLE_EPSILON * 10;

		if (settled) {
			onUpdate(to);
			resolve();
			return;
		}

		onUpdate(position);
		frame = requestAnimationFrame(tick);
	};

	frame = requestAnimationFrame(tick);

	return {
		stop: () => {
			cancelAnimationFrame(frame);
			resolve();
		},
		finished,
	};
};
