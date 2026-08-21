import { createEffect, onCleanup } from "solid-js";

const HISTORY_MARKER = "colibriOverlay";
const BACK_TIMEOUT_MS = 500;

let nextInstanceId = 0;
let historyQueue: Promise<void> = Promise.resolve();

const enqueue = (task: () => void | Promise<void>) => {
	historyQueue = historyQueue.then(task).catch(() => {});
	return historyQueue;
};

const goBackAndWait = (id: number) =>
	new Promise<void>((resolve) => {
		let timer: number | undefined;

		const finish = () => {
			window.removeEventListener("popstate", onPopState);
			if (timer !== undefined) clearTimeout(timer);
			resolve();
		};

		const onPopState = () => {
			if (history.state?.[HISTORY_MARKER] === id) return;
			finish();
		};

		window.addEventListener("popstate", onPopState);
		timer = window.setTimeout(finish, BACK_TIMEOUT_MS);
		history.back();
	});

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

		const id = ++nextInstanceId;
		let closedByPopState = false;
		let listening = false;
		let disposed = false;

		const onPopState = () => {
			if (history.state?.[HISTORY_MARKER] === id) return;
			closedByPopState = true;
			onBack();
		};

		void enqueue(() => {
			if (disposed) return;
			history.pushState({ [HISTORY_MARKER]: id }, "");
			window.addEventListener("popstate", onPopState);
			listening = true;
		});

		onCleanup(() => {
			disposed = true;
			void enqueue(async () => {
				if (listening) {
					window.removeEventListener("popstate", onPopState);
					listening = false;
				}
				if (closedByPopState) return;
				if (history.state?.[HISTORY_MARKER] !== id) return;
				await goBackAndWait(id);
			});
		});
	});
};
