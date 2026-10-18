import { createMediaQuery } from "@solid-primitives/media";
import { type Accessor, createRoot } from "solid-js";

export type Platform = "mobile" | "desktop";

export const DESKTOP_QUERY = "(min-width: 768px)";

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const nativePlatform = (): Platform | undefined => {
	if (!isTauri()) return undefined;
	const agent = navigator.userAgent;
	return /Android|iPhone|iPad/.test(agent) ? "mobile" : "desktop";
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
