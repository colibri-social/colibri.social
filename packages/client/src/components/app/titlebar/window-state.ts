import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
	type Accessor,
	batch,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { isDesktopNative } from "../../../utils/platform";
import { readNativeDecorationsPreference } from "../../../utils/titlebar";

export type WindowState = {
	maximized: Accessor<boolean>;
	fullscreen: Accessor<boolean>;
	nativeDecorations: Accessor<boolean>;
};

type TitlebarStatePayload = {
	fullscreen: boolean;
	maximized: boolean;
	focused: boolean;
	nativeDecorations: boolean;
};

const STATE_EVENT = "colibri-titlebar-state";

export const createWindowState = (): WindowState => {
	const [maximized, setMaximized] = createSignal(false);
	const [fullscreen, setFullscreen] = createSignal(false);
	const [nativeDecorations, setNativeDecorations] = createSignal(
		isDesktopNative() && readNativeDecorationsPreference(),
	);

	if (!isDesktopNative()) {
		return { maximized, fullscreen, nativeDecorations };
	}

	const appWindow = getCurrentWindow();

	let disposed = false;
	let pendingFrame: number | undefined;
	const unlisteners: UnlistenFn[] = [];

	const track = (pending: Promise<UnlistenFn>) => {
		void pending
			.then((unlisten) => {
				if (disposed) unlisten();
				else unlisteners.push(unlisten);
			})
			.catch(() => {});
	};

	const refresh = () => {
		if (pendingFrame !== undefined) return;
		pendingFrame = requestAnimationFrame(() => {
			pendingFrame = undefined;
			void Promise.all([appWindow.isMaximized(), appWindow.isFullscreen()])
				.then(([isMaximized, isFullscreen]) => {
					if (disposed) return;
					batch(() => {
						setMaximized(isMaximized);
						setFullscreen(isFullscreen);
					});
				})
				.catch(() => {});
		});
	};

	onMount(() => {
		refresh();
		track(appWindow.onResized(refresh));
		track(appWindow.onFocusChanged(refresh));
		track(
			appWindow.listen<TitlebarStatePayload>(STATE_EVENT, (event) => {
				batch(() => {
					setMaximized(event.payload.maximized);
					setFullscreen(event.payload.fullscreen);
					setNativeDecorations(event.payload.nativeDecorations);
				});
			}),
		);
	});

	onCleanup(() => {
		disposed = true;
		if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
		for (const unlisten of unlisteners) unlisten();
		unlisteners.length = 0;
	});

	return { maximized, fullscreen, nativeDecorations };
};
