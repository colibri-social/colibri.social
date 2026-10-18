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
import { ResizeEdges } from "./ResizeEdges";
import { createSnapLayouts } from "./snap-layouts";
import {
	BAR_HEIGHT,
	type ChromeMode,
	composeWindowTitle,
	nativeWindow,
	resolveChromeMode,
	windowBarShown,
} from "./window-chrome";
import { createWindowState } from "./window-state";

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
	const { maximized, fullscreen, layout } = createWindowState(mode);
	const [maximizeButton, setMaximizeButton] = createSignal<HTMLElement>();

	const shown = () => windowBarShown(mode());
	const controlsOnLeft = () => mode() === "linux" && layout().side === "left";
	const showControls = () => shown() && mode() !== "macos";

	const snapHovering =
		mode() === "windows"
			? createSnapLayouts({
					element: maximizeButton,
					enabled: () =>
						showControls() &&
						!fullscreen() &&
						layout().order.includes("maximize"),
				})
			: () => false;

	const onContextMenu = (event: MouseEvent) => {
		if (mode() !== "windows" || event.defaultPrevented) return;
		event.preventDefault();
		void nativeWindow.showSystemMenu();
	};

	const controls = () => (
		<WindowControls
			order={layout().order}
			maximized={maximized()}
			hoveredControl={snapHovering() ? "maximize" : undefined}
			maximizeRef={setMaximizeButton}
			onMinimize={nativeWindow.minimize}
			onMaximize={nativeWindow.toggleMaximize}
			onClose={nativeWindow.close}
		/>
	);

	return (
		<Show when={shown()}>
			<Show when={mode() === "linux" && !maximized() && !fullscreen()}>
				<ResizeEdges />
			</Show>
			<WindowBar
				dragRegion
				title={props.title}
				iconSrc={props.iconSrc}
				macInset={mode() === "macos" && !fullscreen()}
				roundedCorners={mode() === "macos"}
				onContextMenu={onContextMenu}
				leading={
					<>
						<Show when={showControls() && controlsOnLeft()}>
							<div data-tauri-drag-region="false" class="-ml-2 h-full">
								{controls()}
							</div>
						</Show>
						<NavButtons />
					</>
				}
				controls={
					<Show when={showControls() && !controlsOnLeft()}>{controls()}</Show>
				}
				class={`${
					BAR_HEIGHT[mode()] === 36
						? "[--titlebar-height:36px]"
						: "[--titlebar-height:32px]"
				}${showControls() ? " pointer-events-auto z-[85]" : ""}`}
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
