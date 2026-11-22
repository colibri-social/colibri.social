export const blockTouchScroll = (
	element: HTMLElement,
	active: () => boolean,
) => {
	const onTouchMove = (event: TouchEvent) => {
		if (event.cancelable && active()) event.preventDefault();
	};
	element.addEventListener("touchmove", onTouchMove, { passive: false });
	return () => element.removeEventListener("touchmove", onTouchMove);
};
