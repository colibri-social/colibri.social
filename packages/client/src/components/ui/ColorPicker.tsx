import { SketchPicker } from "solid-color";
import type { Component } from "solid-js";
import { cx } from "../../utils/cva";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

/** A sensible default palette, reused when a caller doesn't supply its own. */
export const DEFAULT_SWATCHES = [
	"#6d5ae6",
	"#e64980",
	"#ef4444",
	"#f59e0b",
	"#84cc16",
	"#10b981",
	"#06b6d4",
	"#6366f1",
	"#11111b",
	"#ffffff",
];

/**
 * A compact, theme-aware color picker: a swatch button that opens a full
 * saturation/hue picker (built on solid-color's {@link SketchPicker}) in a
 * popover. The chosen color is surfaced as a `#rrggbb` hex string.
 */
export const ColorPicker: Component<{
	value: string;
	onChange: (hex: string) => void;
	/** Quick-pick swatches shown below the picker. */
	presetColors?: string[];
	/** Extra classes for the trigger button. */
	class?: string;
}> = (props) => (
	<Popover>
		<PopoverTrigger
			class={cx(
				"flex items-center gap-2 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm transition-colors hover:bg-muted/40",
				props.class,
			)}
		>
			<span
				class="h-5 w-5 shrink-0 rounded-sm border border-border/60"
				style={{ background: props.value }}
			/>
			<span class="uppercase tabular-nums">{props.value}</span>
		</PopoverTrigger>
		<PopoverContent class="w-auto p-3">
			<SketchPicker
				color={props.value}
				disableAlpha
				width="220px"
				presetColors={props.presetColors ?? DEFAULT_SWATCHES}
				onChange={(c) => props.onChange(c.hex)}
				styles={{
					picker: {
						background: "transparent",
						"box-shadow": "none",
						padding: "0",
						width: "220px",
						"box-sizing": "border-box",
					},
				}}
				className={cx(
					"[&_input]:bg-transparent! [&_input]:text-foreground! [&_input]:rounded-sm!",
					"[&_input]:border! [&_input]:border-border! [&_input]:shadow-none!",
					"[&_label]:text-muted-foreground!",
				)}
			/>
		</PopoverContent>
	</Popover>
);
