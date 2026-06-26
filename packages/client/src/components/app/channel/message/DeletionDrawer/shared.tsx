import { type Component, createEffect, onCleanup } from "solid-js";

/**
 * The header content used in both the mobile and desktop deletion dialog.
 */
export const DialogTitleContent: Component = () => "Delete this message?";

/**
 * The description content used in both the mobile and desktop deletion dialog.
 */
export const DialogDescriptionContent: Component = () =>
	"This action cannot be undone.";

export const useConfirmOnEnter = (
	isOpen: () => boolean,
	confirm: () => void,
) => {
	createEffect(() => {
		if (!isOpen()) return;

		// The modal can be opened by the very Enter keydown that submits an empty
		// edit. Solid runs this effect synchronously while that keydown is still
		// bubbling, so without a guard the same keystroke would reach the listener
		// below and confirm the deletion instantly. Record when we start listening
		// and ignore any keydown that predates it (the opening press) as well as
		// auto-repeat from a held key.
		const armedAt = performance.now();

		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || e.isComposing || e.repeat) return;
			if (e.timeStamp <= armedAt) return;
			e.preventDefault();
			confirm();
		};

		document.addEventListener("keydown", handler);
		onCleanup(() => document.removeEventListener("keydown", handler));
	});
};
