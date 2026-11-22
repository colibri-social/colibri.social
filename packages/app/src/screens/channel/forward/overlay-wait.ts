const DIALOG_SELECTOR = '[role="dialog"]';
const MAX_WAIT_MS = 1500;

const openDialogs = (ignore?: Element) =>
	Array.from(document.querySelectorAll(DIALOG_SELECTOR)).filter(
		(element) => element !== ignore && !element.closest("[data-pane]"),
	);

export const whenOverlaysClosed = (ignore?: Element): Promise<void> =>
	new Promise((resolve) => {
		if (openDialogs(ignore).length === 0) {
			resolve();
			return;
		}
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			clearTimeout(timer);
			requestAnimationFrame(() => resolve());
		};
		const observer = new MutationObserver(() => {
			if (openDialogs(ignore).length === 0) finish();
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["role"],
		});
		const timer = setTimeout(finish, MAX_WAIT_MS);
	});
