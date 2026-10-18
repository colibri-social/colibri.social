import type { WindowControl } from "@colibri-social/ui";
import { createEffect, createRoot, createSignal } from "solid-js";
import { systemWindowControls } from "../../data/system-window-controls";

export type ChromeMode = "macos" | "windows" | "linux" | "none";

const [fixedFrame, setFixedFrame] = createSignal(false);

export { fixedFrame };

export const isNativeShell = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const chromeModeFor = (agent: string, native: boolean): ChromeMode => {
	if (!native) return "none";
	if (/Android|iPhone|iPad/.test(agent)) return "none";
	if (/Mac/.test(agent)) return "macos";
	if (/Windows/.test(agent)) return "windows";
	if (/Linux|X11/.test(agent)) return "linux";
	return "none";
};

export const resolveChromeMode = (): ChromeMode =>
	chromeModeFor(
		typeof navigator === "undefined" ? "" : navigator.userAgent,
		isNativeShell(),
	);

export const markChromeMode = () => {
	const mode = resolveChromeMode();
	const root = document.documentElement;
	root.dataset.chrome = mode;
	createRoot(() =>
		createEffect(() => {
			if (mode !== "none" && !windowBarShown(mode)) {
				root.dataset.windowFrame = "system";
			} else {
				delete root.dataset.windowFrame;
			}
		}),
	);
};

export const BAR_HEIGHT: Record<ChromeMode, number> = {
	macos: 36,
	windows: 32,
	linux: 32,
	none: 0,
};

export const windowBarShown = (mode: ChromeMode = resolveChromeMode()) =>
	mode !== "none" && !systemWindowControls()[0]() && !fixedFrame();

export const windowBarHeight = (mode: ChromeMode = resolveChromeMode()) =>
	windowBarShown(mode) ? BAR_HEIGHT[mode] : 0;

export const desktopRailPaddingTop = (
	mode: ChromeMode = resolveChromeMode(),
) => (windowBarShown(mode) ? undefined : 8);

export const composeWindowTitle = (
	spaceName: string | undefined,
	channelName: string | undefined,
) => {
	if (!spaceName) return "Colibri";
	return channelName ? `${channelName} · ${spaceName}` : spaceName;
};

const RENDERED: readonly WindowControl[] = ["minimize", "maximize", "close"];

const DEFAULT_ORDER: WindowControl[] = ["minimize", "maximize", "close"];

export type ButtonLayout = { left: string[]; right: string[] };

export type ControlsLayout = {
	side: "left" | "right";
	order: WindowControl[];
};

const isControl = (value: string): value is WindowControl =>
	RENDERED.includes(value as WindowControl);

export const controlsLayoutFrom = (
	layout: ButtonLayout | null | undefined,
): ControlsLayout => {
	if (!layout) return { side: "right", order: DEFAULT_ORDER };
	const left = layout.left.filter(isControl);
	const right = layout.right.filter(isControl);
	if (left.length > 0 && right.length === 0) {
		return { side: "left", order: left };
	}
	return { side: "right", order: right };
};

export type PhysicalRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

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

export type ResizeDirection =
	| "North"
	| "South"
	| "East"
	| "West"
	| "NorthEast"
	| "NorthWest"
	| "SouthEast"
	| "SouthWest";

export type WindowState = {
	fullscreen: boolean;
	maximized: boolean;
	nativeDecorations: boolean;
};

export type TitlebarInfo = {
	state?: WindowState;
	buttonLayout?: ButtonLayout | null;
	fixedFrame?: boolean;
};

export const WINDOW_STATE_EVENT = "colibri-titlebar-state";

export const WINDOW_CONTROLS_EVENT = "colibri-titlebar-controls";

const tauriWindow = async () => {
	if (!isNativeShell()) throw new Error("No native shell");
	const { getCurrentWindow } = await import("@tauri-apps/api/window");
	return getCurrentWindow();
};

const tauriInvoke = async <T>(
	command: string,
	args?: Record<string, unknown>,
) => {
	if (!isNativeShell()) throw new Error("No native shell");
	const { invoke } = await import("@tauri-apps/api/core");
	return invoke<T>(command, args);
};

export const nativeWindow = {
	minimize: () =>
		tauriWindow()
			.then((current) => current.minimize())
			.catch(() => {}),
	toggleMaximize: () =>
		tauriWindow()
			.then((current) => current.toggleMaximize())
			.catch(() => {}),
	close: () =>
		tauriWindow()
			.then((current) => current.close())
			.catch(() => {}),
	startResizeDragging: (direction: ResizeDirection) =>
		tauriWindow()
			.then((current) => current.startResizeDragging(direction))
			.catch(() => {}),
	setTitle: (value: string) =>
		tauriInvoke("titlebar_set_title", { title: value }).catch(() => {}),
	isMaximized: () =>
		tauriWindow()
			.then((current) => current.isMaximized())
			.catch(() => false),
	isFullscreen: () =>
		tauriWindow()
			.then((current) => current.isFullscreen())
			.catch(() => false),
	init: () =>
		tauriInvoke<TitlebarInfo | null>("titlebar_init").then(
			(info) => info ?? {},
			(): TitlebarInfo => ({}),
		),
	listen: <T>(event: string, handler: (payload: T) => void) =>
		tauriWindow()
			.then((current) =>
				current.listen<T>(event, (message) => handler(message.payload)),
			)
			.then(
				(stop) => () =>
					void Promise.resolve()
						.then(stop)
						.catch(() => {}),
				() => () => {},
			),
	setSystemControls: (enabled: boolean) =>
		tauriInvoke<WindowState>("titlebar_set_native_decorations", {
			enabled,
		}).catch(() => undefined),
	showSystemMenu: () =>
		tauriInvoke("titlebar_show_system_menu").catch(() => {}),
	setSnapRect: (rect: PhysicalRect) =>
		tauriInvoke("titlebar_set_snap_rect", rect).catch(() => {}),
	clearSnapRect: () => tauriInvoke("titlebar_clear_snap_rect").catch(() => {}),
};

export const restoreSystemWindowControls = () => {
	if (resolveChromeMode() === "none") return;
	const [enabled] = systemWindowControls();
	if (enabled()) void nativeWindow.setSystemControls(true);
};

export const syncFixedFrame = () => {
	if (resolveChromeMode() !== "linux") return;
	void nativeWindow
		.init()
		.then((info) => setFixedFrame(info.fixedFrame === true));
};
