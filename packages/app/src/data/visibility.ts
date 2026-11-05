import { appActive } from "@colibri-social/ui";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

const visibleNow = () =>
	typeof document === "undefined" || document.visibilityState === "visible";

const [visible, setVisible] = createSignal(visibleNow());

if (typeof document !== "undefined") {
	document.addEventListener("visibilitychange", () => setVisible(visibleNow()));
}

export const documentVisible = visible;

export const appVisible = () => documentVisible() && appActive();

export const ACTIVITY_THROTTLE_MS = 60_000;

const ACTIVITY_INPUTS = [
	"pointerdown",
	"pointermove",
	"keydown",
	"wheel",
	"touchstart",
] as const;

export const trackActivity = (report: () => void): void => {
	createEffect(
		on(appVisible, (shown) => {
			if (!shown) return;
			let reportedAt = Date.now();
			report();
			if (typeof window === "undefined") return;
			const onInput = () => {
				const now = Date.now();
				if (now - reportedAt < ACTIVITY_THROTTLE_MS) return;
				reportedAt = now;
				report();
			};
			for (const type of ACTIVITY_INPUTS) {
				window.addEventListener(type, onInput, {
					capture: true,
					passive: true,
				});
			}
			onCleanup(() => {
				for (const type of ACTIVITY_INPUTS) {
					window.removeEventListener(type, onInput, { capture: true });
				}
			});
		}),
	);
};
