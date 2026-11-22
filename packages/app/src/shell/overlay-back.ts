import { historyGo, isProgrammaticPop } from "./history-go";

const OVERLAY_KEY = "colibriOverlay";
const DIALOG_SELECTOR = '[role="dialog"]';

const openDialogs = () =>
	Array.from(document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)).filter(
		(element) =>
			element.isConnected &&
			element.getAttribute("aria-hidden") !== "true" &&
			!element.closest("[data-pane]"),
	);

const overlayDepth = (state: unknown) => {
	const value = (state as Record<string, unknown> | null)?.[OVERLAY_KEY];
	return typeof value === "number" ? value : 0;
};

export const installOverlayBack = () => {
	let tracked = 0;
	let frame = 0;

	const dismissTop = () => {
		const top = openDialogs().at(-1);
		top?.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
				code: "Escape",
				bubbles: true,
				cancelable: true,
			}),
		);
	};

	const reconcile = () => {
		frame = 0;
		const count = openDialogs().length;
		if (count > tracked) {
			for (let level = tracked + 1; level <= count; level++) {
				const state = (window.history.state ?? {}) as Record<string, unknown>;
				window.history.pushState({ ...state, [OVERLAY_KEY]: level }, "");
			}
			tracked = count;
			return;
		}
		if (count < tracked) {
			const steps = tracked - count;
			tracked = count;
			if (overlayDepth(window.history.state) > count) {
				historyGo(-steps, { silent: true });
			}
		}
	};

	const observer = new MutationObserver(() => {
		if (!frame) frame = requestAnimationFrame(reconcile);
	});
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["role", "aria-hidden"],
	});

	const onPop = (event: PopStateEvent) => {
		if (isProgrammaticPop(event)) return;
		const target = overlayDepth(event.state);
		if (tracked > target) {
			event.stopImmediatePropagation();
			tracked = target;
			const count = openDialogs().length;
			for (let level = count; level > target; level--) dismissTop();
		}
	};
	window.addEventListener("popstate", onPop);

	return () => {
		observer.disconnect();
		window.removeEventListener("popstate", onPop);
		if (frame) cancelAnimationFrame(frame);
	};
};
