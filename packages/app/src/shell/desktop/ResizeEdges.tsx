import { For } from "solid-js";
import { nativeWindow, type ResizeDirection } from "./window-chrome";

const EDGES: { direction: ResizeDirection; class: string }[] = [
	{ direction: "North", class: "inset-x-3 top-0 h-1 cursor-n-resize" },
	{ direction: "South", class: "inset-x-3 bottom-0 h-1 cursor-s-resize" },
	{ direction: "West", class: "inset-y-3 left-0 w-1 cursor-w-resize" },
	{ direction: "East", class: "inset-y-3 right-0 w-1 cursor-e-resize" },
	{ direction: "NorthWest", class: "top-0 left-0 size-3 cursor-nw-resize" },
	{ direction: "NorthEast", class: "top-0 right-0 size-3 cursor-ne-resize" },
	{
		direction: "SouthWest",
		class: "bottom-0 left-0 size-3 cursor-sw-resize",
	},
	{
		direction: "SouthEast",
		class: "right-0 bottom-0 size-3 cursor-se-resize",
	},
];

export const ResizeEdges = () => (
	<div
		data-resize-edges=""
		aria-hidden="true"
		class="pointer-events-none fixed inset-0 z-[86]"
	>
		<For each={EDGES}>
			{(edge) => (
				<div
					data-resize-edge={edge.direction}
					class={`pointer-events-auto absolute ${edge.class}`}
					onPointerDown={(event) => {
						if (event.button !== 0) return;
						event.preventDefault();
						void nativeWindow.startResizeDragging(edge.direction);
					}}
				/>
			)}
		</For>
	</div>
);
