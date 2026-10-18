import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { nameColorStyle, themedColor } from "../../utils/name-color";
import { ColorPicker } from "../ColorPicker/ColorPicker";
import { TextField } from "../TextField/TextField";

export const DISPLAY_NAME_MAX_LENGTH = 32;

export const DEFAULT_NAME_COLOR = "#ffffff";

export type DisplayNameFieldProps = {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	nameColor?: string;
	onNameColorChange?: (color: string) => void;
	onNameColorChangeEnd?: (color: string) => void;
	nameColorPresets?: string[];
	label?: JSX.Element;
	description?: JSX.Element;
	error?: JSX.Element;
	placeholder?: string;
	disabled?: boolean;
	platform?: "desktop" | "mobile";
	class?: string;
};

export const DisplayNameField = (props: DisplayNameFieldProps) => {
	const color = () => themedColor(props.nameColor);

	return (
		<div
			data-display-name-field=""
			class={cx("flex w-full", props.class)}
			style={nameColorStyle(color())}
		>
			<TextField
				label={props.label ?? "Display name"}
				description={props.description}
				error={props.error}
				value={props.value}
				defaultValue={props.defaultValue}
				onChange={props.onChange}
				placeholder={props.placeholder}
				disabled={props.disabled}
				maxLength={DISPLAY_NAME_MAX_LENGTH}
				autocomplete="nickname"
				class={cx(
					color() &&
						"[&_input]:text-(--name-color-dark) light:[&_input]:text-(--name-color-light)",
				)}
				trailingAction={
					<Show when={props.onNameColorChange}>
						{(onChange) => (
							<ColorPicker
								label="Name color"
								value={props.nameColor ?? DEFAULT_NAME_COLOR}
								onChange={onChange()}
								onChangeEnd={props.onNameColorChangeEnd}
								presets={props.nameColorPresets}
								platform={props.platform}
								disabled={props.disabled}
								class="ml-2 w-10 flex-none"
							/>
						)}
					</Show>
				}
			/>
		</div>
	);
};
