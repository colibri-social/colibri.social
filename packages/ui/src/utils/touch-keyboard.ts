export type NativeTouchKeyboardRestart = () => boolean;

let nativeRestart: NativeTouchKeyboardRestart | undefined;
let focusDecoy: HTMLTextAreaElement | undefined;

export const setNativeTouchKeyboardRestart = (
	restart: NativeTouchKeyboardRestart | undefined,
) => {
	nativeRestart = restart;
};

export const restartNativeTouchKeyboard = () => {
	return nativeRestart?.() ?? false;
};

const decoy = () => {
	if (focusDecoy?.isConnected) return focusDecoy;
	const element = document.createElement("textarea");
	element.tabIndex = -1;
	element.setAttribute("aria-hidden", "true");
	element.setAttribute("data-touch-keyboard-decoy", "");
	element.style.cssText =
		"position:fixed;left:0;bottom:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;pointer-events:none;";
	document.body.append(element);
	focusDecoy = element;

	return element;
};

export const swapTouchKeyboardFocus = (refocus: () => void) => {
	decoy().focus({ preventScroll: true });
	refocus();
};
