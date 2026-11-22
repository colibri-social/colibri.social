import { createEffect, onCleanup } from "solid-js";

let activeMenuClose: (() => void) | undefined;

export const claimActiveMenu = (close: () => void) => {
	const previous = activeMenuClose;
	activeMenuClose = close;
	if (previous && previous !== close) previous();
};

export const releaseActiveMenu = (close: () => void) => {
	if (activeMenuClose === close) activeMenuClose = undefined;
};

export const hasActiveMenu = () => {
	return activeMenuClose !== undefined;
};

export const closeActiveMenu = () => {
	const close = activeMenuClose;
	activeMenuClose = undefined;
	close?.();
};

export const trackActiveMenu = (open: () => boolean, close: () => void) => {
	createEffect(() => {
		if (open()) claimActiveMenu(close);
		else releaseActiveMenu(close);
	});
	onCleanup(() => releaseActiveMenu(close));
};

const openOverlays = new Set<() => void>();

export const addOpenOverlay = (close: () => void) => {
	openOverlays.add(close);

	return () => {
		openOverlays.delete(close);
	};
};

export const closeAllOverlays = () => {
	const closers = [...openOverlays];

	openOverlays.clear();

	for (const close of closers) close();
};

export const trackOpenOverlay = (open: () => boolean, close: () => void) => {
	createEffect(() => {
		if (!open()) return;

		onCleanup(addOpenOverlay(close));
	});
};
