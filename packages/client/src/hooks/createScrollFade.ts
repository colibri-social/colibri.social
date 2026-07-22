import { createEffect, createSignal, onCleanup } from "solid-js";

export const createScrollFade = () => {
	const [el, setEl] = createSignal<HTMLElement>();
	const [canScrollDown, setCanScrollDown] = createSignal(false);

	createEffect(() => {
		const node = el();
		if (!node) return;

		const update = () =>
			setCanScrollDown(
				node.scrollHeight - node.scrollTop - node.clientHeight > 1,
			);

		update();
		node.addEventListener("scroll", update, { passive: true });
		const resizeObserver = new ResizeObserver(update);
		resizeObserver.observe(node);
		const mutationObserver = new MutationObserver(update);
		mutationObserver.observe(node, { childList: true, subtree: true });

		onCleanup(() => {
			node.removeEventListener("scroll", update);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		});
	});

	return { ref: setEl, canScrollDown };
};
