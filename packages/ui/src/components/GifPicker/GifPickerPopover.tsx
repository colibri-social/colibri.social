import { splitProps } from "solid-js";
import {
	AnchoredPicker,
	type AnchoredPickerProps,
} from "../EmojiPicker/EmojiPickerPopover";
import { type Gif, GifPicker, type GifPickerProps } from "./GifPicker";

export type GifPickerPopoverProps = Omit<GifPickerProps, "platform"> &
	AnchoredPickerProps;

export const GifPickerPopover = (props: GifPickerPopoverProps) => {
	const [anchored, picker] = splitProps(props, [
		"open",
		"onOpenChange",
		"platform",
		"anchor",
		"anchorElement",
		"placement",
		"label",
		"onPick",
	]);

	const onPick = (gif: Gif, event: MouseEvent) => {
		anchored.onPick(gif, event);
		anchored.onOpenChange(false);
	};

	return (
		<AnchoredPicker
			open={anchored.open}
			onOpenChange={anchored.onOpenChange}
			platform={anchored.platform}
			anchor={anchored.anchor}
			anchorElement={anchored.anchorElement}
			placement={anchored.placement}
			label={anchored.label ?? "GIF picker"}
			class="w-[352px]"
		>
			<GifPicker
				{...picker}
				platform={anchored.platform}
				autofocus
				onPick={onPick}
			/>
		</AnchoredPicker>
	);
};
