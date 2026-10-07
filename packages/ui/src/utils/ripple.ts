import { type Accessor, onCleanup } from "solid-js";
import type { HapticImpact, Haptics } from "./haptics";
import { useHaptics } from "./haptics";
import { motionScale, prefersReducedMotion } from "./motion";

const WAVE_SOLID_STOP = 0.72;
export type RipplePointerType = "touch" | "pen" | "mouse";

export type RippleOptions = {
	pointerTypes?: RipplePointerType[];
	haptic?: HapticImpact;
	disabled?: Accessor<boolean | undefined>;
	placement?: "under" | "over";
};

const GROW_MS = 420;
const FADE_MS = 260;
const MIN_VISIBLE_MS = 90;
const GROW_EASING = "cubic-bezier(0.2, 0.3, 0.1, 1)";
const FADE_EASING = "cubic-bezier(0.3, 0, 0.3, 1)";
const PRESS_KEYS = new Set([" ", "Enter"]);
const DEFAULT_POINTER_TYPES: RipplePointerType[] = ["touch", "pen"];
const DISABLED_SELECTOR = ":disabled, [aria-disabled='true'], [data-disabled]";

type Wave = { node: HTMLSpanElement; startedAt: number; fading: boolean };

const NOISE_TILE_PX = 128;
const NOISE_DEPTH = 0.16;
let noiseInstalled = false;

const installNoise = () => {
	if (noiseInstalled || typeof document === "undefined") return;
	noiseInstalled = true;
	const density = Math.min(
		3,
		Math.max(1, Math.round(window.devicePixelRatio || 1)),
	);
	const size = NOISE_TILE_PX * density;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");
	if (!context) return;
	const image = context.createImageData(size, size);
	for (let index = 0; index < image.data.length; index += 4) {
		image.data[index] = 255;
		image.data[index + 1] = 255;
		image.data[index + 2] = 255;
		image.data[index + 3] = Math.round(255 * (1 - Math.random() * NOISE_DEPTH));
	}
	context.putImageData(image, 0, 0);
	const root = document.documentElement.style;
	root.setProperty("--ripple-noise", `url(${canvas.toDataURL("image/png")})`);
	root.setProperty(
		"--ripple-noise-size",
		`${NOISE_TILE_PX}px ${NOISE_TILE_PX}px`,
	);
};

const layerFor = (host: HTMLElement) => {
	const existing = host.querySelector<HTMLElement>(
		":scope > [data-ripple-layer]",
	);
	if (existing) return existing;
	const layer = document.createElement("span");
	layer.setAttribute("data-ripple-layer", "");
	layer.setAttribute("aria-hidden", "true");
	host.prepend(layer);
	return layer;
};

export const attachRipple = (
	host: HTMLElement,
	options: RippleOptions & { haptics?: Haptics } = {},
) => {
	const pointerTypes = options.pointerTypes ?? DEFAULT_POINTER_TYPES;
	const waves = new Set<Wave>();
	const timers = new Set<ReturnType<typeof setTimeout>>();

	const isDisabled = () =>
		!!options.disabled?.() || host.matches(DISABLED_SELECTOR);

	const spawn = (x: number, y: number) => {
		installNoise();
		const layer = layerFor(host);
		if (options.placement === "over")
			layer.setAttribute("data-placement", "over");
		const rect = layer.getBoundingClientRect();
		const reach = Math.hypot(
			Math.max(x, rect.width - x),
			Math.max(y, rect.height - y),
		);
		const radius = reach / WAVE_SOLID_STOP;
		const node = document.createElement("span");
		node.setAttribute("data-ripple-wave", "");
		node.style.width = `${radius * 2}px`;
		node.style.height = `${radius * 2}px`;
		node.style.left = `${x - radius}px`;
		node.style.top = `${y - radius}px`;
		node.style.setProperty("--ripple-solid", `${WAVE_SOLID_STOP * 100}%`);
		layer.append(node);

		const reduced = prefersReducedMotion();
		node.animate(
			reduced
				? [{ opacity: 1, transform: "scale(1)" }]
				: [
						{ opacity: 0.5, transform: "scale(0.2)" },
						{ opacity: 1, offset: 0.2 },
						{ opacity: 1, transform: "scale(1)" },
					],
			{
				duration: reduced ? 0 : GROW_MS * motionScale(),
				easing: GROW_EASING,
				fill: "forwards",
			},
		);
		waves.add({ node, startedAt: performance.now(), fading: false });
		if (options.haptic) options.haptics?.impact(options.haptic);
	};

	const fade = (wave: Wave) => {
		wave.fading = true;
		const animation = wave.node.animate([{ opacity: 0 }], {
			duration: FADE_MS * motionScale(),
			easing: FADE_EASING,
			fill: "forwards",
		});
		const remove = () => {
			wave.node.remove();
			waves.delete(wave);
		};
		animation.finished.then(remove, remove);
	};

	const release = () => {
		const now = performance.now();
		for (const wave of waves) {
			if (wave.fading) continue;
			const wait = MIN_VISIBLE_MS * motionScale() - (now - wave.startedAt);
			if (wait <= 0) {
				fade(wave);
				continue;
			}
			wave.fading = true;
			const timer = setTimeout(() => {
				timers.delete(timer);
				wave.fading = false;
				fade(wave);
			}, wait);
			timers.add(timer);
		}
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.button !== 0 || isDisabled()) return;
		if (!pointerTypes.includes(event.pointerType as RipplePointerType)) return;
		const rect = layerFor(host).getBoundingClientRect();
		spawn(event.clientX - rect.left, event.clientY - rect.top);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.repeat || !PRESS_KEYS.has(event.key) || isDisabled()) return;
		if (event.target !== host) return;
		const rect = layerFor(host).getBoundingClientRect();
		spawn(rect.width / 2, rect.height / 2);
	};

	const onKeyUp = (event: KeyboardEvent) => {
		if (PRESS_KEYS.has(event.key)) release();
	};

	host.addEventListener("pointerdown", onPointerDown);
	host.addEventListener("pointerup", release);
	host.addEventListener("pointercancel", release);
	host.addEventListener("pointerleave", release);
	host.addEventListener("keydown", onKeyDown);
	host.addEventListener("keyup", onKeyUp);
	host.addEventListener("blur", release);

	return () => {
		host.removeEventListener("pointerdown", onPointerDown);
		host.removeEventListener("pointerup", release);
		host.removeEventListener("pointercancel", release);
		host.removeEventListener("pointerleave", release);
		host.removeEventListener("keydown", onKeyDown);
		host.removeEventListener("keyup", onKeyUp);
		host.removeEventListener("blur", release);
		for (const timer of timers) clearTimeout(timer);
		for (const wave of waves) wave.node.remove();
		waves.clear();
	};
};

export const createRipple = (options: RippleOptions = {}) => {
	const haptics = useHaptics();
	let dispose: (() => void) | undefined;
	onCleanup(() => dispose?.());
	return (host: HTMLElement) => {
		dispose?.();
		dispose = attachRipple(host, { ...options, haptics });
	};
};
