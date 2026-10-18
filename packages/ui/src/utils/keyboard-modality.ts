import { createSignal } from "solid-js";

const MODIFIER_KEYS = new Set([
	"Shift",
	"Control",
	"Alt",
	"Meta",
	"AltGraph",
	"CapsLock",
]);

const NAVIGATION_KEYS = new Set([
	"Tab",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Home",
	"End",
	"PageUp",
	"PageDown",
	"F6",
]);

export const isHoverPointer = (event: PointerEvent) =>
	event.pointerType !== "touch" && event.pointerType !== "pen";

const [keyboardModality, setKeyboardModality] = createSignal(false);
const [touchModality, setTouchModality] = createSignal(false);
let navigationKeyPressed = false;
let installed = false;

const install = () => {
	if (installed || typeof document === "undefined") return;
	installed = true;
	document.addEventListener(
		"pointerdown",
		(event) => {
			navigationKeyPressed = false;
			setKeyboardModality(false);
			setTouchModality(!isHoverPointer(event));
		},
		{ capture: true, passive: true },
	);
	document.addEventListener(
		"pointermove",
		(event) => {
			if (event.pointerType === "mouse") setTouchModality(false);
		},
		{ capture: true, passive: true },
	);
	document.addEventListener(
		"keydown",
		(event) => {
			setTouchModality(false);
			if (MODIFIER_KEYS.has(event.key)) return;
			navigationKeyPressed = NAVIGATION_KEYS.has(event.key);
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			setKeyboardModality(true);
		},
		{ capture: true, passive: true },
	);
};

export const useKeyboardModality = () => {
	install();
	return keyboardModality;
};

export const useTouchModality = () => {
	install();
	return touchModality;
};

export const focusFollowsNavigationKey = () => {
	install();
	return navigationKeyPressed;
};

export const KEYBOARD_FOCUS_ATTRIBUTE = "data-keyboard-focus";

export const keyboardFocusWithin = () => {
	const keyboard = useKeyboardModality();
	return {
		onFocusIn: (event: FocusEvent & { currentTarget: HTMLElement }) => {
			event.currentTarget.toggleAttribute(KEYBOARD_FOCUS_ATTRIBUTE, keyboard());
		},
		onFocusOut: (event: FocusEvent & { currentTarget: HTMLElement }) => {
			const next = event.relatedTarget as Node | null;
			if (next && event.currentTarget.contains(next)) return;
			event.currentTarget.removeAttribute(KEYBOARD_FOCUS_ATTRIBUTE);
		},
		onPointerDown: (event: PointerEvent & { currentTarget: HTMLElement }) => {
			event.currentTarget.removeAttribute(KEYBOARD_FOCUS_ATTRIBUTE);
		},
	};
};
