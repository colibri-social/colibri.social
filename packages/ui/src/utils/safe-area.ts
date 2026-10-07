import { type Accessor, createSignal } from "solid-js";

export type SafeAreaInsets = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};

export type OverflowPadding = SafeAreaInsets;

export const SAFE_AREA_CHANGE_EVENT = "colibri-safe-area-change";
export const KEYBOARD_INSET_EVENT = "colibri-keyboard-inset";
export const BASE_OVERFLOW_PADDING = 8;

const ZERO_INSETS: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };

const toPixels = (value: string) => {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

export const readSafeAreaInsets = (): SafeAreaInsets => {
	if (typeof document === "undefined") return { ...ZERO_INSETS };
	const parent = document.body ?? document.documentElement;
	if (!parent) return { ...ZERO_INSETS };
	const probe = document.createElement("div");
	probe.setAttribute("aria-hidden", "true");
	probe.style.cssText =
		"position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:var(--safe-area-top,0px);padding-bottom:var(--safe-area-bottom,0px);padding-left:var(--safe-area-left,0px);padding-right:var(--safe-area-right,0px);";
	parent.appendChild(probe);
	const style = getComputedStyle(probe);
	const insets: SafeAreaInsets = {
		top: toPixels(style.paddingTop),
		bottom: toPixels(style.paddingBottom),
		left: toPixels(style.paddingLeft),
		right: toPixels(style.paddingRight),
	};
	probe.remove();
	return insets;
};

const sameInsets = (a: SafeAreaInsets, b: SafeAreaInsets) =>
	a.top === b.top &&
	a.bottom === b.bottom &&
	a.left === b.left &&
	a.right === b.right;

let sharedInsets: Accessor<SafeAreaInsets> | undefined;

const createSharedInsets = (): Accessor<SafeAreaInsets> => {
	const [insets, setInsets] = createSignal(readSafeAreaInsets(), {
		equals: sameInsets,
	});
	let frame = 0;
	const refresh = () => {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			setInsets(readSafeAreaInsets());
		});
	};
	window.addEventListener("resize", refresh);
	window.addEventListener("orientationchange", refresh);
	window.addEventListener(KEYBOARD_INSET_EVENT, refresh);
	window.addEventListener(SAFE_AREA_CHANGE_EVENT, refresh);
	window.visualViewport?.addEventListener("resize", refresh);
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", refresh, { once: true });
	}
	return insets;
};

export const useSafeAreaInsets = (): Accessor<SafeAreaInsets> => {
	if (typeof window === "undefined") return () => ZERO_INSETS;
	if (!sharedInsets) sharedInsets = createSharedInsets();
	return sharedInsets;
};

const paddingFor = (insets: SafeAreaInsets, base: number): OverflowPadding => ({
	top: base + insets.top,
	right: base + insets.right,
	bottom: base + insets.bottom,
	left: base + insets.left,
});

export const useOverflowPadding = (
	base = BASE_OVERFLOW_PADDING,
): Accessor<OverflowPadding> => {
	const insets = useSafeAreaInsets();
	return () => paddingFor(insets(), base);
};

export const safeAreaOverflowPadding = (
	base = BASE_OVERFLOW_PADDING,
): OverflowPadding => paddingFor(readSafeAreaInsets(), base);

export const usePopperOverflowPadding = (
	base = BASE_OVERFLOW_PADDING,
): Accessor<number> => {
	const insets = useSafeAreaInsets();
	return () => {
		const current = insets();
		return (
			base + Math.max(current.top, current.right, current.bottom, current.left)
		);
	};
};

export const notifySafeAreaChange = () => {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(SAFE_AREA_CHANGE_EVENT));
};

const SIDES = ["top", "bottom", "left", "right"] as const;

export const applySafeAreaInsets = (insets: SafeAreaInsets | null) => {
	if (typeof document === "undefined") return;
	const style = document.documentElement.style;
	for (const side of SIDES) {
		if (insets) style.setProperty(`--safe-area-${side}`, `${insets[side]}px`);
		else style.removeProperty(`--safe-area-${side}`);
	}
	notifySafeAreaChange();
};
