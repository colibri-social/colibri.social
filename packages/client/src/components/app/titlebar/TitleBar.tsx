import { invoke } from "@tauri-apps/api/core";
import {
	type Component,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { useIsMobile } from "../../../utils/mobile-pane";
import {
	isDesktopNative,
	isLinux,
	isMacOS,
	isWindows,
} from "../../../utils/platform";
import { shellCommunity } from "../../../utils/shell-title";
import { createControlsLayout } from "./controls-layout";
import { NavButtons } from "./NavButtons";
import { createSnapLayouts } from "./snap-layouts";
import { WindowControls } from "./WindowControls";
import { createWindowState } from "./window-state";

export type TitleBarProps = {
	variant?: "shell" | "bare";
};

export const TitleBar: Component<TitleBarProps> = (props) => {
	const isMobile = useIsMobile();
	const desktop = isDesktopNative();
	const { maximized, fullscreen, nativeDecorations } = createWindowState();
	const { side, order } = createControlsLayout();

	const [barEl, setBarEl] = createSignal<HTMLDivElement | undefined>();
	const [leadingEl, setLeadingEl] = createSignal<HTMLDivElement | undefined>();
	const [trailingEl, setTrailingEl] = createSignal<
		HTMLDivElement | undefined
	>();
	const [maximizeEl, setMaximizeEl] = createSignal<
		HTMLButtonElement | undefined
	>();
	const [gutter, setGutter] = createSignal(0);

	const chromeless = () => desktop && !nativeDecorations();
	const isBare = () => props.variant === "bare";
	const showControls = () => chromeless() && !isMacOS();
	const controlsOnLeft = () => isLinux() && side() === "left";
	const macInset = () => isMacOS() && chromeless() && !fullscreen();
	const community = () => (isBare() ? undefined : shellCommunity());

	const snapHovering = createSnapLayouts({
		element: maximizeEl,
		container: barEl,
		enabled: () =>
			showControls() &&
			isWindows() &&
			!fullscreen() &&
			order().includes("maximize"),
	});

	onMount(() => {
		const observer = new ResizeObserver(() => {
			setGutter(
				Math.max(
					leadingEl()?.getBoundingClientRect().width ?? 0,
					trailingEl()?.getBoundingClientRect().width ?? 0,
				),
			);
		});
		const leading = leadingEl();
		const trailing = trailingEl();
		if (leading) observer.observe(leading);
		if (trailing) observer.observe(trailing);
		onCleanup(() => observer.disconnect());
	});

	const onContextMenu = (event: MouseEvent) => {
		if (!isWindows() || !chromeless() || event.defaultPrevented) return;
		event.preventDefault();
		void invoke("titlebar_show_system_menu").catch(() => {});
	};

	return (
		<div
			ref={setBarEl}
			data-tauri-drag-region={chromeless() ? "deep" : undefined}
			onContextMenu={onContextMenu}
			class="relative flex w-full shrink-0 select-none items-center justify-between bg-card h-[var(--titlebar-height)] min-h-[var(--titlebar-height)]"
			classList={{ hidden: isMobile() || !desktop }}
			style={{ "--titlebar-gutter": `${gutter()}px` }}
		>
			<div
				ref={setLeadingEl}
				class="flex h-full shrink-0 items-center gap-1 px-2"
				classList={{ "order-last": controlsOnLeft() }}
			>
				<Show when={macInset() && !controlsOnLeft()}>
					<div class="h-full w-[var(--titlebar-leading-inset)] shrink-0" />
				</Show>
				<Show when={!isBare()}>
					<NavButtons />
				</Show>
			</div>

			<Show when={community()}>
				{(active) => (
					<div class="pointer-events-none absolute inset-y-0 left-[var(--titlebar-gutter)] right-[var(--titlebar-gutter)] flex select-none items-center justify-center gap-2">
						<Show when={active().picture}>
							{(picture) => (
								<img
									src={picture()}
									alt=""
									width={20}
									height={20}
									class="size-5 shrink-0 select-none rounded-sm object-cover"
									draggable={false}
								/>
							)}
						</Show>
						<span class="truncate select-none text-sm font-medium text-muted-foreground">
							{active().name}
						</span>
					</div>
				)}
			</Show>

			<div
				ref={setTrailingEl}
				data-tauri-drag-region={chromeless() ? "false" : undefined}
				class="flex h-full shrink-0 items-center"
				classList={{ "order-first": controlsOnLeft() }}
			>
				<Show when={showControls()}>
					<WindowControls
						order={order()}
						maximized={maximized()}
						snapHovering={snapHovering()}
						onMaximizeRef={setMaximizeEl}
					/>
				</Show>
			</div>
		</div>
	);
};

export default TitleBar;
