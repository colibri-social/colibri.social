import { onCleanup } from "solid-js";

const POINTER_GRACE_MS = 150;

export const createFocusRetention = () => {
	let lastPointer = Number.NEGATIVE_INFINITY;
	const onPointer = () => {
		lastPointer = performance.now();
	};
	if (typeof document !== "undefined") {
		document.addEventListener("pointerdown", onPointer, true);
		onCleanup(() =>
			document.removeEventListener("pointerdown", onPointer, true),
		);
	}
	return (event: FocusEvent) => {
		if (event.relatedTarget) return false;
		const target = event.target as HTMLElement | null;
		if (!target || performance.now() - lastPointer < POINTER_GRACE_MS)
			return false;
		queueMicrotask(() => {
			const active = document.activeElement;
			if (active && active !== document.body) return;
			if (!target.isConnected || !document.hasFocus()) return;
			target.focus({ preventScroll: true });
		});
		return true;
	};
};
