import { getCurrentWindow } from "@tauri-apps/api/window";
import { type Component, createSignal, For, Show } from "solid-js";
import type { WindowControl } from "./controls-layout";

type WindowControlsProps = {
	order: Array<WindowControl>;
	maximized: boolean;
	snapHovering: boolean;
	onMaximizeRef: (el: HTMLButtonElement | undefined) => void;
};

const CELL_CLASS =
	"inline-flex h-full w-[46px] shrink-0 items-center justify-center border-0 bg-transparent p-0 text-foreground/85 outline-none transition-colors duration-75 data-[hovered]:bg-foreground/10 data-[pressed]:bg-foreground/5";

const CLOSE_CLASS =
	"data-[hovered]:bg-[#c42b1c] data-[hovered]:text-white data-[pressed]:bg-[#b2261a] data-[pressed]:text-white";

const Glyph: Component<{ children: string }> = (props) => (
	<svg
		width="10"
		height="10"
		viewBox="0 0 10 10"
		fill="none"
		stroke="currentColor"
		stroke-width="1"
		shape-rendering="crispEdges"
		aria-hidden="true"
	>
		<path d={props.children} />
	</svg>
);

const MinimizeGlyph = () => <Glyph>M0 5.5h10</Glyph>;

const MaximizeGlyph = () => <Glyph>M0.5 0.5h9v9h-9z</Glyph>;

const RestoreGlyph = () => <Glyph>M2.5 2.5v-2h7v7h-2M0.5 2.5h7v7h-7z</Glyph>;

const CloseGlyph = () => <Glyph>M0.5 0.5l9 9M9.5 0.5l-9 9</Glyph>;

export const WindowControls: Component<WindowControlsProps> = (props) => {
	const [hovered, setHovered] = createSignal<WindowControl | null>(null);
	const [pressed, setPressed] = createSignal<WindowControl | null>(null);

	const isHovered = (control: WindowControl) =>
		control === "maximize"
			? props.snapHovering || hovered() === "maximize"
			: hovered() === control && !props.snapHovering;

	const activate = (control: WindowControl) => {
		const appWindow = getCurrentWindow();
		if (control === "minimize") void appWindow.minimize().catch(() => {});
		if (control === "maximize") void appWindow.toggleMaximize().catch(() => {});
		if (control === "close") void appWindow.close().catch(() => {});
	};

	const label = (control: WindowControl) => {
		if (control === "minimize") return "Minimize";
		if (control === "close") return "Close";
		return props.maximized ? "Restore" : "Maximize";
	};

	return (
		<For each={props.order}>
			{(control) => (
				<button
					type="button"
					ref={(el) => {
						if (control === "maximize") props.onMaximizeRef(el);
					}}
					class={CELL_CLASS}
					classList={{ [CLOSE_CLASS]: control === "close" }}
					aria-label={label(control)}
					title={label(control)}
					data-hovered={isHovered(control) ? "" : undefined}
					data-pressed={pressed() === control ? "" : undefined}
					onPointerEnter={() => setHovered(control)}
					onPointerLeave={() => {
						setHovered((current) => (current === control ? null : current));
						setPressed((current) => (current === control ? null : current));
					}}
					onPointerDown={() => setPressed(control)}
					onPointerUp={() => setPressed(null)}
					onClick={() => activate(control)}
				>
					<Show when={control === "minimize"}>
						<MinimizeGlyph />
					</Show>
					<Show when={control === "maximize"}>
						<Show when={props.maximized} fallback={<MaximizeGlyph />}>
							<RestoreGlyph />
						</Show>
					</Show>
					<Show when={control === "close"}>
						<CloseGlyph />
					</Show>
				</button>
			)}
		</For>
	);
};
