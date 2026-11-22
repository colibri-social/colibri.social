import { createMediaQuery } from "@solid-primitives/media";
import { type Accessor, createRoot } from "solid-js";
import { isTouchDevice } from "../shell/desktop/window-chrome";

export type Platform = "mobile" | "desktop";

const DESKTOP_QUERY = "(min-width: 768px)";

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const nativePlatform = (): Platform | undefined => {
	if (!isTauri()) return undefined;
	return isTouchDevice(navigator.userAgent, navigator.maxTouchPoints)
		? "mobile"
		: "desktop";
};

let shared: Accessor<Platform> | undefined;

export const usePlatform = (): Accessor<Platform> => {
	if (shared) return shared;
	const native = nativePlatform();
	if (native) {
		shared = () => native;
		return shared;
	}
	shared = createRoot(() => {
		const desktop = createMediaQuery(DESKTOP_QUERY);
		return () => (desktop() ? "desktop" : "mobile");
	});
	return shared;
};
