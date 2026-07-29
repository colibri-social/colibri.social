import type { Component } from "solid-js";
import { ColorPicker } from "../../ui/ColorPicker";

export const ColorRow: Component<{
	label: string;
	value: string;
	onChange: (value: string) => void;
}> = (props) => (
	<div class="flex flex-row items-center justify-between gap-3 text-sm">
		<span>{props.label}</span>
		<ColorPicker value={props.value} onChange={props.onChange} />
	</div>
);
