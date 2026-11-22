import { closeAllOverlays } from "@colibri-social/ui";
import { batch, createSignal, onCleanup, onMount } from "solid-js";
import {
	type ChromeMode,
	type ControlsLayout,
	controlsLayoutFrom,
	nativeWindow,
	WINDOW_STATE_EVENT,
	type WindowState,
} from "./window-chrome";

export const createWindowState = (mode: () => ChromeMode) => {
	const [maximized, setMaximized] = createSignal(false);
	const [fullscreen, setFullscreen] = createSignal(false);
	const [layout, setLayout] = createSignal<ControlsLayout>(
		controlsLayoutFrom(null),
	);

	const apply = (state: WindowState) =>
		batch(() => {
			setMaximized(state.maximized);
			setFullscreen(state.fullscreen);
		});

	onMount(() => {
		if (mode() === "none") return;
		let disposed = false;
		let width = window.innerWidth;
		let height = window.innerHeight;
		const closeOverlaysOnResize = () => {
			if (window.innerWidth === width && window.innerHeight === height) return;

			width = window.innerWidth;
			height = window.innerHeight;
			closeAllOverlays();
		};
		const refresh = () =>
			void Promise.all([
				nativeWindow.isMaximized(),
				nativeWindow.isFullscreen(),
			]).then(([isMaximized, isFullscreen]) => {
				if (disposed) return;
				batch(() => {
					setMaximized(isMaximized);
					setFullscreen(isFullscreen);
				});
			});
		const onResize = () => {
			closeOverlaysOnResize();
			refresh();
		};
		refresh();
		window.addEventListener("resize", onResize);
		void nativeWindow.init().then((info) => {
			if (disposed) return;
			if (mode() === "linux") setLayout(controlsLayoutFrom(info.buttonLayout));
		});
		const unlisten = nativeWindow.listen<WindowState>(
			WINDOW_STATE_EVENT,
			(state) => {
				closeOverlaysOnResize();
				apply(state);
			},
		);
		onCleanup(() => {
			disposed = true;
			window.removeEventListener("resize", onResize);
			void unlisten.then((stop) => stop());
		});
	});

	return { maximized, fullscreen, layout };
};
