import { setAppActive } from "@colibri-social/ui";
import { currentReleasePlatform } from "../data/release-notes";
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

type VisibilityDocument = Pick<
	Document,
	"visibilityState" | "addEventListener" | "removeEventListener"
>;

const isMobileShell = () => {
	const platform = currentReleasePlatform();
	return platform === "ios" || platform === "android";
};

export const installMobileActivity = (
	target: VisibilityDocument = document,
): (() => void) => {
	const sync = () => setAppActive(target.visibilityState === "visible");
	target.addEventListener("visibilitychange", sync);
	sync();
	return () => {
		target.removeEventListener("visibilitychange", sync);
		setAppActive(undefined);
	};
};

export const installAppActivity = (
	options: {
		enabled?: boolean;
		mobile?: boolean;
		window?: () => Promise<FocusWindow>;
	} = {},
): (() => void) => {
	if (options.mobile ?? isMobileShell()) return installMobileActivity();
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
