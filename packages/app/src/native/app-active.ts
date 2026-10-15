import { setAppActive } from "@colibri-social/ui";
import { resolveChromeMode } from "../shell/desktop/window-chrome";

type FocusWindow = {
	isFocused: () => Promise<boolean>;
	onFocusChanged: (
		handler: (event: { payload: boolean }) => void,
	) => Promise<() => void>;
};

const currentWindow = async (): Promise<FocusWindow> => {
	const { getCurrentWindow } = await import("@tauri-apps/api/window");
	return getCurrentWindow();
};

export const installAppActivity = (
	options: { enabled?: boolean; window?: () => Promise<FocusWindow> } = {},
): (() => void) => {
	const enabled = options.enabled ?? resolveChromeMode() !== "none";
	if (!enabled) return () => {};
	let disposed = false;
	let unlisten: (() => void) | undefined;
	let changed = false;
	void (options.window ?? currentWindow)()
		.then(async (target) => {
			const stop = await target.onFocusChanged(({ payload }) => {
				changed = true;
				setAppActive(payload);
			});
			if (disposed) {
				stop();
				return;
			}
			unlisten = stop;
			const focused = await target.isFocused();
			if (!disposed && !changed) setAppActive(focused);
		})
		.catch(() => undefined);
	return () => {
		disposed = true;
		unlisten?.();
		setAppActive(undefined);
	};
};
