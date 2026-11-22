import { createSignal } from "solid-js";

type WebkitDocument = Document & { webkitFullscreenElement?: Element | null };

const fullscreenElement = () =>
	typeof document === "undefined"
		? null
		: (document.fullscreenElement ??
			(document as WebkitDocument).webkitFullscreenElement ??
			null);

const [fullscreen, setFullscreen] = createSignal(!!fullscreenElement());
const [lightboxes, setLightboxes] = createSignal(0);

if (typeof document !== "undefined") {
	const sync = () => setFullscreen(!!fullscreenElement());
	document.addEventListener("fullscreenchange", sync);
	document.addEventListener("webkitfullscreenchange", sync);
}

export const mediaCoversPage = () => fullscreen() || lightboxes() > 0;

export const holdLightboxCover = () => {
	setLightboxes((count) => count + 1);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		setLightboxes((count) => count - 1);
	};
};
