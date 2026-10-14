import { onCleanup } from "solid-js";

const PROPERTY = "--toast-bottom-offset";

export const liftToasts = (footer: HTMLElement) => {
	const root = document.documentElement;
	const sync = () => {
		const top = footer.getBoundingClientRect().top;
		const offset = footer.isConnected
			? Math.max(0, Math.round(window.innerHeight - top))
			: 0;
		root.style.setProperty(PROPERTY, `${offset}px`);
	};
	const observer = new ResizeObserver(sync);
	observer.observe(footer);
	window.addEventListener("resize", sync);
	sync();
	onCleanup(() => {
		observer.disconnect();
		window.removeEventListener("resize", sync);
		root.style.removeProperty(PROPERTY);
	});
};
