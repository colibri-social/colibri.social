import { type Accessor, createSignal } from "solid-js";

export type SafeAreaInsets = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};

const ZERO_INSETS: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 };

const BASE_OVERFLOW_PADDING = 8;

export const readSafeAreaInsets = (): SafeAreaInsets => {
	if (typeof document === "undefined") return { ...ZERO_INSETS };

	const probe = document.createElement("div");
	probe.style.cssText =
		"position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--safe-area-top);padding-bottom:var(--safe-area-bottom);padding-left:var(--safe-area-left);padding-right:var(--safe-area-right);";
	document.body.appendChild(probe);
	const cs = getComputedStyle(probe);
	const px = (v: string): number => {
		const n = Number.parseFloat(v);
		return Number.isFinite(n) ? n : 0;
	};
	const insets: SafeAreaInsets = {
		top: px(cs.paddingTop),
		bottom: px(cs.paddingBottom),
		left: px(cs.paddingLeft),
		right: px(cs.paddingRight),
	};
	probe.remove();
	return insets;
};

const sameInsets = (a: SafeAreaInsets, b: SafeAreaInsets): boolean =>
	a.top === b.top &&
	a.bottom === b.bottom &&
	a.left === b.left &&
	a.right === b.right;

let sharedInsets: Accessor<SafeAreaInsets> | undefined;

const createSharedInsets = (): Accessor<SafeAreaInsets> => {
	const [insets, setInsets] = createSignal(readSafeAreaInsets());

	const refresh = () => {
		const next = readSafeAreaInsets();
		setInsets((prev) => (sameInsets(prev, next) ? prev : next));
	};

	window.addEventListener("resize", refresh);
	window.addEventListener("orientationchange", refresh);
	window.addEventListener("colibri-keyboard-inset", refresh);

	return insets;
};

export const useSafeAreaInsets = (): Accessor<SafeAreaInsets> => {
	if (typeof window === "undefined") {
		const [insets] = createSignal(ZERO_INSETS);
		return insets;
	}

	if (!sharedInsets) sharedInsets = createSharedInsets();
	return sharedInsets;
};

const paddingFor = (insets: SafeAreaInsets): number =>
	BASE_OVERFLOW_PADDING +
	Math.max(insets.top, insets.right, insets.bottom, insets.left);

export const useOverflowPadding = (): Accessor<number> => {
	const insets = useSafeAreaInsets();
	return () => paddingFor(insets());
};

export const safeAreaOverflowPadding = (): number =>
	paddingFor(readSafeAreaInsets());
