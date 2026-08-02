import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { isWindows } from "../../../utils/platform";

export type PhysicalRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const CONTROLS_EVENT = "colibri-titlebar-controls";

const DPI_SETTLE_MS = 100;

export const toPhysicalRect = (
	rect: { left: number; top: number; right: number; bottom: number },
	dpr: number,
): PhysicalRect => {
	const x = Math.floor(rect.left * dpr);
	const y = Math.floor(rect.top * dpr);
	return {
		x,
		y,
		width: Math.ceil(rect.right * dpr) - x,
		height: Math.ceil(rect.bottom * dpr) - y,
	};
};

export type SnapLayoutOptions = {
	element: Accessor<HTMLElement | undefined>;
	container: Accessor<HTMLElement | undefined>;
	enabled: Accessor<boolean>;
};

export const createSnapLayouts = (
	options: SnapLayoutOptions,
): Accessor<boolean> => {
	const [hovering, setHovering] = createSignal(false);

	if (!isWindows()) return hovering;

	const appWindow = getCurrentWindow();

	let disposed = false;
	let pendingFrame: number | undefined;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	let lastSent: string | null = null;
	const unlisteners: UnlistenFn[] = [];

	const track = (pending: Promise<UnlistenFn>) => {
		void pending
			.then((unlisten) => {
				if (disposed) unlisten();
				else unlisteners.push(unlisten);
			})
			.catch(() => {});
	};

	const clear = () => {
		if (lastSent === null) return;
		lastSent = null;
		setHovering(false);
		void invoke("titlebar_clear_snap_rect").catch(() => {});
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

		void invoke("titlebar_set_snap_rect", rect).catch(() => {});
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
		const container = options.container();
		if (element) observer.observe(element);
		if (container) observer.observe(container);
		schedule();
	});

	createEffect(() => {
		options.enabled();
		schedule();
	});

	window.addEventListener("resize", schedule);
	armDpiQuery();
	track(appWindow.onResized(schedule));
	track(appWindow.onScaleChanged(onDpiChange));
	track(
		appWindow.listen<{ button: string | null }>(CONTROLS_EVENT, (event) => {
			setHovering(event.payload.button === "maximize");
		}),
	);

	void document.fonts?.ready.then(schedule).catch(() => {});

	requestAnimationFrame(() => requestAnimationFrame(schedule));

	onCleanup(() => {
		disposed = true;
		if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
		if (settleTimer !== undefined) clearTimeout(settleTimer);
		observer.disconnect();
		window.removeEventListener("resize", schedule);
		dpiQuery?.removeEventListener("change", onDpiChange);
		for (const unlisten of unlisteners) unlisten();
		unlisteners.length = 0;
		void invoke("titlebar_clear_snap_rect").catch(() => {});
	});

	return hovering;
};
