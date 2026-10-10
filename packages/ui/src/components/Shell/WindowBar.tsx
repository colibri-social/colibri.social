import {
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";

export type WindowControl = "minimize" | "maximize" | "close";

export type WindowControlsProps = {
	order?: WindowControl[];
	maximized?: boolean;
	onMinimize?: () => void;
	onMaximize?: () => void;
	onClose?: () => void;
	class?: string;
};

const CELL =
	"inline-flex h-full w-[46px] shrink-0 cursor-default items-center justify-center border-0 bg-transparent p-0 text-foreground/85 outline-none hover:bg-foreground/10 active:bg-foreground/5 focus-ring-inset";

const CLOSE =
	"hover:bg-[#c42b1c] hover:text-white active:bg-[#b2261a] active:text-white";

const Glyph = (props: { d: string; diagonal?: boolean }) => (
	<svg
		width="10"
		height="10"
		viewBox="0 0 10 10"
		fill="none"
		stroke="currentColor"
		stroke-width="1"
		shape-rendering={props.diagonal ? "geometricPrecision" : "crispEdges"}
		aria-hidden="true"
	>
		<path d={props.d} />
	</svg>
);

export const WindowControls = (props: WindowControlsProps) => {
	const order = () => props.order ?? ["minimize", "maximize", "close"];
	const label = (control: WindowControl) => {
		if (control === "minimize") return "Minimize";
		if (control === "close") return "Close";
		return props.maximized ? "Restore" : "Maximize";
	};
	const glyph = (control: WindowControl) => {
		if (control === "minimize") return <Glyph d="M0 5.5h10" />;
		if (control === "close")
			return <Glyph d="M0.5 0.5l9 9M9.5 0.5l-9 9" diagonal />;
		return props.maximized ? (
			<Glyph d="M2.5 2.5v-2h7v7h-2M0.5 2.5h7v7h-7z" />
		) : (
			<Glyph d="M0.5 0.5h9v9h-9z" />
		);
	};
	const activate = (control: WindowControl) => {
		if (control === "minimize") props.onMinimize?.();
		else if (control === "close") props.onClose?.();
		else props.onMaximize?.();
	};

	return (
		<div
			data-window-controls=""
			class={cx("flex h-full items-stretch", props.class)}
		>
			<For each={order()}>
				{(control) => (
					<button
						type="button"
						aria-label={label(control)}
						data-control={control}
						onClick={() => activate(control)}
						class={cx(CELL, control === "close" && CLOSE)}
					>
						{glyph(control)}
					</button>
				)}
			</For>
		</div>
	);
};

export type WindowBarProps = {
	title?: JSX.Element;
	iconSrc?: string;
	leading?: JSX.Element;
	controls?: JSX.Element;
	macInset?: boolean;
	dragRegion?: boolean;
	onContextMenu?: (event: MouseEvent) => void;
	class?: string;
};

export const WindowBar = (props: WindowBarProps) => {
	const title = createSlot(() => props.title);
	const leading = createSlot(() => props.leading);
	const controls = createSlot(() => props.controls);
	const [gutter, setGutter] = createSignal(0);
	let leadingBox: HTMLDivElement | undefined;
	let trailingBox: HTMLDivElement | undefined;

	onMount(() => {
		const measure = () =>
			setGutter(
				Math.max(
					leadingBox?.getBoundingClientRect().width ?? 0,
					trailingBox?.getBoundingClientRect().width ?? 0,
				),
			);
		const observer = new ResizeObserver(measure);
		if (leadingBox) observer.observe(leadingBox);
		if (trailingBox) observer.observe(trailingBox);
		measure();
		onCleanup(() => observer.disconnect());
	});

	return (
		<div
			data-window-bar=""
			data-tauri-drag-region={props.dragRegion ? "deep" : undefined}
			onContextMenu={(event) => props.onContextMenu?.(event)}
			class={cx(
				"relative flex h-(--titlebar-height,36px) min-h-(--titlebar-height,36px) w-full shrink-0 items-center justify-between bg-background select-none",
				props.class,
			)}
			style={{ "--titlebar-gutter": `${gutter()}px` }}
		>
			<div
				ref={leadingBox}
				data-window-bar-leading=""
				class="flex h-full shrink-0 items-center gap-1 px-2"
			>
				<Show when={props.macInset}>
					<div
						data-traffic-light-inset=""
						class="h-full w-(--titlebar-leading-inset,72px) shrink-0"
					/>
				</Show>
				<Show when={leading.has()}>{leading()}</Show>
			</div>
			<Show when={title.has()}>
				<div class="pointer-events-none absolute inset-y-0 right-(--titlebar-gutter) left-(--titlebar-gutter) flex items-center justify-center gap-2">
					<Show when={props.iconSrc}>
						{(src) => (
							<AnimatedImage
								src={src()}
								alt=""
								width={20}
								height={20}
								draggable={false}
								class="size-5 shrink-0 rounded-control-xs object-cover"
							/>
						)}
					</Show>
					<span class="truncate text-sm font-medium text-muted-foreground">
						{title()}
					</span>
				</div>
			</Show>
			<div
				ref={trailingBox}
				data-window-bar-trailing=""
				data-tauri-drag-region={props.dragRegion ? "false" : undefined}
				class="flex h-full shrink-0 items-center"
			>
				<Show when={controls.has()}>{controls()}</Show>
			</div>
		</div>
	);
};
