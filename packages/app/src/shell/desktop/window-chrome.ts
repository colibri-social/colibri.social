import type { WindowControl } from "@colibri-social/ui";

export type ChromeMode = "macos" | "windows" | "linux" | "none";

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

export const BAR_HEIGHT: Record<ChromeMode, number> = {
	macos: 36,
	windows: 32,
	linux: 32,
	none: 0,
};

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
	buttonLayout: () =>
		tauriInvoke<{ buttonLayout?: ButtonLayout | null }>("titlebar_init").then(
			(info) => info?.buttonLayout ?? null,
			() => null,
		),
};
