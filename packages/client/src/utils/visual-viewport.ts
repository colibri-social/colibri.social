import { type Accessor, createSignal, onCleanup } from "solid-js";
import { isIOSTauriRuntimeSync } from "./platform";

export type ViewportMetrics = {
	height: Accessor<number | undefined>;
	offsetTop: Accessor<number>;
	keyboardInset: Accessor<number>;
	keyboardAnimating: Accessor<boolean>;
};

const KEYBOARD_SETTLE_FALLBACK_MS = 400;

/**
 * Tracks the VisualViewport so the app shell can be sized to the area the user
 * can actually see.
 */
export const createViewportMetrics = (): ViewportMetrics => {
	const [vvHeight, setVvHeight] = createSignal<number | undefined>();
	const [offsetTop, setOffsetTop] = createSignal(0);
	const [keyboardInset, setKeyboardInset] = createSignal(0);
	const [keyboardAnimating, setKeyboardAnimating] = createSignal(false);

	let hasNativeKeyboardInset = false;

	const height = () =>
		hasNativeKeyboardInset
			? Math.max(window.innerHeight - keyboardInset(), window.innerHeight * 0.3)
			: vvHeight();

	if (typeof window !== "undefined") {
		const tracksKeyboardAnimation = isIOSTauriRuntimeSync();
		let settleTimer: number | undefined;

		const settle = () => {
			if (settleTimer !== undefined) clearTimeout(settleTimer);
			settleTimer = undefined;
			setKeyboardAnimating(false);
		};

		const onKeyboardInset = (event: Event) => {
			hasNativeKeyboardInset = true;
			const detail = (event as CustomEvent<number>).detail ?? 0;
			const clamped = Math.min(Math.max(detail, 0), window.innerHeight * 0.7);
			if (clamped === keyboardInset()) return;
			if (tracksKeyboardAnimation) {
				setKeyboardAnimating(true);
				if (settleTimer !== undefined) clearTimeout(settleTimer);
				settleTimer = window.setTimeout(settle, KEYBOARD_SETTLE_FALLBACK_MS);
			}
			setKeyboardInset(clamped);
		};

		window.addEventListener("colibri-keyboard-inset", onKeyboardInset);
		window.addEventListener("colibri-keyboard-inset-end", settle);
		onCleanup(() => {
			window.removeEventListener("colibri-keyboard-inset", onKeyboardInset);
			window.removeEventListener("colibri-keyboard-inset-end", settle);
			if (settleTimer !== undefined) clearTimeout(settleTimer);
		});
	}

	const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
	if (!vv) return { height, offsetTop, keyboardInset, keyboardAnimating };

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

	return { height, offsetTop, keyboardInset, keyboardAnimating };
};
