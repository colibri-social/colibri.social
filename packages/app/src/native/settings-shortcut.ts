import { classifyThrown, createLogger } from "@colibri-social/lib";
import type { Layer } from "../shell/layers";

const log = createLogger("native");

export const OPEN_SETTINGS_EVENT = "colibri-open-settings";

export type SettingsOpener = {
	push: (layer: Layer) => void;
	top?: () => Layer | undefined;
};

type Listen = (event: string, handler: () => void) => Promise<() => void>;

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const tauriListen: Listen = (event, handler) =>
	import("@tauri-apps/api/event").then(({ listen }) => listen(event, handler));

export const openSettings = (stack: SettingsOpener): void => {
	if (stack.top?.()?.kind === "settings") return;
	stack.push({ kind: "settings" });
};

export const listenForSettingsShortcut = (
	stack: SettingsOpener,
	listen: Listen | undefined = isTauri() ? tauriListen : undefined,
): (() => void) => {
	if (!listen) return () => {};
	let stopped = false;
	let unlisten: (() => void) | undefined;
	listen(OPEN_SETTINGS_EVENT, () => openSettings(stack)).then(
		(stop) => {
			if (stopped) stop();
			else unlisten = stop;
		},
		(err: unknown) => {
			log.warn("listening for the settings shortcut failed", {
				code: classifyThrown(err).code,
			});
		},
	);
	return () => {
		stopped = true;
		unlisten?.();
	};
};
