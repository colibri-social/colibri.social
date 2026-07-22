import { type Accessor, createSignal, onCleanup } from "solid-js";

export type ViewportMetrics = {
	height: Accessor<number | undefined>;
	offsetTop: Accessor<number>;
	keyboardInset: Accessor<number>;
};

/**
 * Tracks the VisualViewport so the app shell can be sized to the area the user
 * can actually see.
 */
export const createViewportMetrics = (): ViewportMetrics => {
	const [vvHeight, setVvHeight] = createSignal<number | undefined>();
	const [offsetTop, setOffsetTop] = createSignal(0);
	const [keyboardInset, setKeyboardInset] = createSignal(0);

	const height = () =>
		keyboardInset() > 0 ? window.innerHeight - keyboardInset() : vvHeight();

	if (typeof window !== "undefined") {
		const onKeyboardInset = (event: Event) => {
			setKeyboardInset((event as CustomEvent<number>).detail ?? 0);
		};
		window.addEventListener("colibri-keyboard-inset", onKeyboardInset);
		onCleanup(() =>
			window.removeEventListener("colibri-keyboard-inset", onKeyboardInset),
		);
	}

	const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
	if (!vv) return { height, offsetTop, keyboardInset };

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

	return { height, offsetTop, keyboardInset };
};
