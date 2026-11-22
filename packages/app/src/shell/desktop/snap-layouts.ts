import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import {
	nativeWindow,
	toPhysicalRect,
	WINDOW_CONTROLS_EVENT,
} from "./window-chrome";

const DPI_SETTLE_MS = 100;

export const createSnapLayouts = (options: {
	element: Accessor<HTMLElement | undefined>;
	enabled: Accessor<boolean>;
}): Accessor<boolean> => {
	const [hovering, setHovering] = createSignal(false);
	let disposed = false;
	let pendingFrame: number | undefined;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	let lastSent: string | null = null;

	const clear = () => {
		setHovering(false);
		if (lastSent === null) return;
		lastSent = null;
		void nativeWindow.clearSnapRect();
	};

	const send = () => {
		if (disposed) return;
		const element = options.element();
		if (!element || !options.enabled()) {
			clear();
			return;
		}
		const rect = toPhysicalRect(
			element.getBoundingClientRect(),
			window.devicePixelRatio,
		);
		if (rect.width <= 0 || rect.height <= 0) {
			clear();
			return;
		}
		const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
		if (key === lastSent) return;
		lastSent = key;
		void nativeWindow.setSnapRect(rect);
	};

	const schedule = () => {
		if (disposed || pendingFrame !== undefined) return;
		pendingFrame = requestAnimationFrame(() => {
			pendingFrame = undefined;
			send();
		});
	};

	let dpiQuery: MediaQueryList | undefined;
	const armDpiQuery = () => {
		dpiQuery?.removeEventListener("change", onDpiChange);
		dpiQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		dpiQuery.addEventListener("change", onDpiChange);
	};
	function onDpiChange() {
		armDpiQuery();
		schedule();
		if (settleTimer !== undefined) clearTimeout(settleTimer);
		settleTimer = setTimeout(schedule, DPI_SETTLE_MS);
	}

	const observer = new ResizeObserver(schedule);
	createEffect(() => {
		observer.disconnect();
		const element = options.element();
		if (element) observer.observe(element);
		options.enabled();
		schedule();
	});

	window.addEventListener("resize", schedule);
	armDpiQuery();
	const unlisten = nativeWindow.listen<{ button: string | null }>(
		WINDOW_CONTROLS_EVENT,
		(payload) => setHovering(payload.button === "maximize"),
	);
	void document.fonts?.ready.then(schedule).catch(() => {});

	onCleanup(() => {
		disposed = true;
		if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
		if (settleTimer !== undefined) clearTimeout(settleTimer);
		observer.disconnect();
		window.removeEventListener("resize", schedule);
		dpiQuery?.removeEventListener("change", onDpiChange);
		void unlisten.then((stop) => stop());
		if (lastSent !== null) void nativeWindow.clearSnapRect();
	});

	return hovering;
};
