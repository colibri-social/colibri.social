import { IconButton, WindowBar, WindowControls } from "@colibri-social/ui";
import { AltArrowLeftIcon } from "@solar-icons/solid/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import {
	batch,
	createEffect,
	createSignal,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { useData } from "../../data/store";
import { useDesktopShell } from "./context";
import {
	BAR_HEIGHT,
	type ChromeMode,
	type ControlsLayout,
	composeWindowTitle,
	controlsLayoutFrom,
	nativeWindow,
	resolveChromeMode,
} from "./window-chrome";

type NavigationLike = EventTarget & {
	canGoBack?: boolean;
	canGoForward?: boolean;
};

const navigationApi = () =>
	(globalThis as unknown as { navigation?: NavigationLike }).navigation;

const TITLE_DEBOUNCE_MS = 150;

const NavButtons = () => {
	const [canGoBack, setCanGoBack] = createSignal(true);
	const [canGoForward, setCanGoForward] = createSignal(true);
	onMount(() => {
		const api = navigationApi();
		if (!api || api.canGoBack === undefined) return;
		const sync = () =>
			batch(() => {
				setCanGoBack(!!api.canGoBack);
				setCanGoForward(!!api.canGoForward);
			});
		sync();
		api.addEventListener("currententrychange", sync);
		onCleanup(() => api.removeEventListener("currententrychange", sync));
	});
	return (
		<div
			data-tauri-drag-region="false"
			data-title-bar-nav=""
			class="flex h-full shrink-0 items-center gap-0.5"
		>
			<IconButton
				variant="ghost"
				size="sm"
				label="Back"
				tooltipPlacement="bottom"
				icon={<AltArrowLeftIcon />}
				disabled={!canGoBack()}
				onClick={() => history.back()}
			/>
			<IconButton
				variant="ghost"
				size="sm"
				label="Forward"
				tooltipPlacement="bottom"
				icon={<AltArrowRightIcon />}
				disabled={!canGoForward()}
				onClick={() => history.forward()}
			/>
		</div>
	);
};

export const WindowChrome = (props: {
	mode?: ChromeMode;
	title?: string;
	iconSrc?: string;
}) => {
	const mode = () => props.mode ?? resolveChromeMode();
	const [maximized, setMaximized] = createSignal(false);
	const [fullscreen, setFullscreen] = createSignal(false);
	const [layout, setLayout] = createSignal<ControlsLayout>(
		controlsLayoutFrom(null),
	);

	onMount(() => {
		if (mode() === "none") return;
		const refresh = () =>
			void Promise.all([
				nativeWindow.isMaximized(),
				nativeWindow.isFullscreen(),
			]).then(([isMaximized, isFullscreen]) =>
				batch(() => {
					setMaximized(isMaximized);
					setFullscreen(isFullscreen);
				}),
			);
		refresh();
		window.addEventListener("resize", refresh);
		onCleanup(() => window.removeEventListener("resize", refresh));
		if (mode() === "linux") {
			void nativeWindow
				.buttonLayout()
				.then((next) => setLayout(controlsLayoutFrom(next)));
		}
	});

	const controlsOnLeft = () => mode() === "linux" && layout().side === "left";

	const controls = () => (
		<WindowControls
			order={layout().order}
			maximized={maximized()}
			onMinimize={nativeWindow.minimize}
			onMaximize={nativeWindow.toggleMaximize}
			onClose={nativeWindow.close}
		/>
	);

	return (
		<Show when={mode() !== "none"}>
			<WindowBar
				dragRegion
				title={props.title}
				iconSrc={props.iconSrc}
				macInset={mode() === "macos" && !fullscreen()}
				roundedCorners={mode() === "macos"}
				leading={
					<>
						<Show when={controlsOnLeft()}>
							<div data-tauri-drag-region="false" class="-ml-2 h-full">
								{controls()}
							</div>
						</Show>
						<NavButtons />
					</>
				}
				controls={
					<Show when={mode() !== "macos" && !controlsOnLeft()}>
						{controls()}
					</Show>
				}
				class={
					BAR_HEIGHT[mode()] === 36
						? "[--titlebar-height:36px]"
						: "[--titlebar-height:32px]"
				}
			/>
		</Show>
	);
};

export const TitleBar = (props: { mode?: ChromeMode }) => {
	const data = useData();
	const shell = useDesktopShell();
	const mode = () => props.mode ?? resolveChromeMode();

	const space = () => {
		const key = shell.stack.route().root.space;
		return key ? data.spaceByKey(key) : undefined;
	};
	const channelName = () => {
		const chat = shell.stack.route().chat;
		const community = space();
		if (!chat || !community) return undefined;
		return data.space(community).channelBySlug(chat.channel)?.name;
	};
	const title = () => composeWindowTitle(space()?.name, channelName());

	createEffect(
		on(title, (next) => {
			const timer = setTimeout(() => {
				document.title = next;
				if (mode() !== "none") void nativeWindow.setTitle(next);
			}, TITLE_DEBOUNCE_MS);
			onCleanup(() => clearTimeout(timer));
		}),
	);

	return (
		<WindowChrome
			mode={props.mode}
			title={space()?.name}
			iconSrc={space()?.picture}
		/>
	);
};
