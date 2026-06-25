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

		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || e.isComposing) return;
			e.preventDefault();
			confirm();
		};

		document.addEventListener("keydown", handler);
		onCleanup(() => document.removeEventListener("keydown", handler));
	});
};
