import { onCleanup } from "solid-js";
import { createLongPress } from "./long-press";

export type MenuTriggerOptions = {
	onMenu: (event: Event) => void;
	enabled?: () => boolean;
};

export const createMenuTrigger = (
	element: HTMLElement,
	options: MenuTriggerOptions,
) => {
	const isEnabled = () => !options.enabled || options.enabled();
	let lastPointerType: string | undefined;

	const onPointerDown = (event: PointerEvent) => {
		lastPointerType = event.pointerType;
	};

	const onContextMenu = (event: MouseEvent) => {
		if (!isEnabled()) return;
		if (lastPointerType && lastPointerType !== "mouse") return;
		event.preventDefault();
		event.stopPropagation();
		options.onMenu(event);
	};

	createLongPress(element, {
		enabled: isEnabled,
		onLongPress: (event) => options.onMenu(event),
	});

	element.addEventListener("pointerdown", onPointerDown, {
		capture: true,
		passive: true,
	});
	element.addEventListener("contextmenu", onContextMenu);

	onCleanup(() => {
		element.removeEventListener("pointerdown", onPointerDown, {
			capture: true,
		});
		element.removeEventListener("contextmenu", onContextMenu);
	});
};
