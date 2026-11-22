const CLOSE_TIMEOUT_MS = 800;

export const MENU_SELECTOR = '[role="menu"]';
export const EMOJI_POPOVER_SELECTOR = "[data-emoji-popover]";

export const afterClosed = (selector: string, run: () => void) => {
	const started = performance.now();
	const check = () => {
		const open = document.querySelector(selector);
		if (!open || performance.now() - started > CLOSE_TIMEOUT_MS) {
			run();
			return;
		}
		requestAnimationFrame(check);
	};
	requestAnimationFrame(check);
};
