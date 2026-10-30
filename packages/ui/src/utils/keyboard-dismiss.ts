import { useTouchModality } from "./keyboard-modality";

const TEXT_INPUT_TYPES = new Set([
	"",
	"text",
	"search",
	"email",
	"url",
	"tel",
	"password",
	"number",
]);

export const isEditableElement = (
	element: Element | null,
): element is HTMLElement => {
	if (!(element instanceof HTMLElement)) return false;
	if (element.isContentEditable) return true;
	if (element instanceof HTMLTextAreaElement)
		return !element.readOnly && !element.disabled;
	if (element instanceof HTMLInputElement)
		return (
			TEXT_INPUT_TYPES.has(element.type) &&
			!element.readOnly &&
			!element.disabled
		);
	return false;
};

const touchModality = useTouchModality();

const hasCoarsePointer = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(pointer: coarse)").matches;

export const usesOnScreenKeyboard = () => hasCoarsePointer() || touchModality();

export const dismissKeyboard = (inside?: Element | null) => {
	if (typeof document === "undefined" || !usesOnScreenKeyboard()) return;
	const active = document.activeElement;
	if (!isEditableElement(active) || inside?.contains(active)) return;
	active.blur();
};
