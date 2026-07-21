import { createEffect, onCleanup } from "solid-js";

const HISTORY_MARKER = "colibriOverlay";

/**
 * Pushes a history entry while `open()` is true so the mobile back
 * gesture / hardware back button closes the overlay (drawer, sheet, ...)
 * instead of leaving the app or navigating the underlying route, mirroring
 * the URL-driven pane stack in mobile-pane.ts.
 */
export const createHistoryBackClose = (
	open: () => boolean,
	onBack: () => void,
) => {
	createEffect(() => {
		if (!open()) return;

		history.pushState({ [HISTORY_MARKER]: true }, "");
		let closedByPopState = false;

		const onPopState = () => {
			closedByPopState = true;
			onBack();
		};
		window.addEventListener("popstate", onPopState);

		onCleanup(() => {
			window.removeEventListener("popstate", onPopState);
			if (!closedByPopState && history.state?.[HISTORY_MARKER]) {
				history.back();
			}
		});
	});
};
