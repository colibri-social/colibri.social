const redispatched = new WeakSet<Event>();

const NATIVE_MENU_TARGETS =
	'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const insideNativeTarget = (element: Element | null) =>
	!!element?.closest(NATIVE_MENU_TARGETS);

export const resolveContextTarget = (event: MouseEvent): Element | null => {
	if (
		event.clientX === 0 &&
		event.clientY === 0 &&
		event.target instanceof Element
	)
		return event.target;
	return document.elementFromPoint(event.clientX, event.clientY);
};

const pointerInside = (element: Element, x: number, y: number) => {
	for (const rect of element.getClientRects()) {
		if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
			return true;
	}
	return false;
};

const keepsNativeMenu = (event: MouseEvent, hit: Element | null) => {
	const original = event.target instanceof Element ? event.target : null;
	return insideNativeTarget(hit) || insideNativeTarget(original);
};

export const installContextMenuGuard = (root: Document = document) => {
	const retarget = (event: MouseEvent) => {
		if (redispatched.has(event)) return;
		const original = event.target instanceof Element ? event.target : null;
		const hit = resolveContextTarget(event) ?? original;
		if (keepsNativeMenu(event, hit)) return;
		if (!hit || !original || hit === original || hit.contains(original)) return;
		if (pointerInside(original, event.clientX, event.clientY)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		const next = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			composed: true,
			clientX: event.clientX,
			clientY: event.clientY,
			screenX: event.screenX,
			screenY: event.screenY,
			button: event.button,
			buttons: event.buttons,
			ctrlKey: event.ctrlKey,
			shiftKey: event.shiftKey,
			altKey: event.altKey,
			metaKey: event.metaKey,
		});
		redispatched.add(next);
		hit.dispatchEvent(next);
	};
	const suppress = (event: MouseEvent) => {
		if (event.defaultPrevented) return;
		const hit = resolveContextTarget(event);
		if (keepsNativeMenu(event, hit)) return;
		event.preventDefault();
	};
	const suppressing = isTauri();
	root.addEventListener("contextmenu", retarget, { capture: true });
	if (suppressing) root.addEventListener("contextmenu", suppress);
	return () => {
		root.removeEventListener("contextmenu", retarget, { capture: true });
		if (suppressing) root.removeEventListener("contextmenu", suppress);
	};
};
