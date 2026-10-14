import { createEffect, onCleanup } from "solid-js";

export type InteractOutsideEvent = CustomEvent<{ originalEvent: Event }>;

export type AnchorToggleOptions = {
	anchor: () => Element | undefined;
	open: () => boolean;
	close: () => void;
};

export const createAnchorToggle = (options: AnchorToggleOptions) => {
	const within = (target: EventTarget | null) => {
		const anchor = options.anchor();
		return !!anchor && target instanceof Node && anchor.contains(target);
	};
	let pressed: Element | undefined;

	const onPointerDown = (event: PointerEvent) => {
		pressed = within(event.target) ? options.anchor() : undefined;
	};

	const onClick = (event: MouseEvent) => {
		const source = event.detail === 0 ? options.anchor() : pressed;
		pressed = undefined;
		if (!source || source !== options.anchor() || !within(event.target)) return;
		event.preventDefault();
		event.stopPropagation();
		options.close();
	};

	createEffect(() => {
		if (!options.open()) return;
		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("click", onClick, true);
		onCleanup(() => {
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("click", onClick, true);
			pressed = undefined;
		});
	});

	return (event: InteractOutsideEvent) => {
		if (within(event.detail.originalEvent.target)) event.preventDefault();
	};
};
