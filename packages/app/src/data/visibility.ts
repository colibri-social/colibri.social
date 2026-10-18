import { createSignal } from "solid-js";

const visibleNow = () =>
	typeof document === "undefined" || document.visibilityState === "visible";

const [visible, setVisible] = createSignal(visibleNow());

if (typeof document !== "undefined") {
	document.addEventListener("visibilitychange", () => setVisible(visibleNow()));
}

export const documentVisible = visible;
