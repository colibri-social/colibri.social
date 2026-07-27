import { createSignal, For } from "solid-js";
import {
	Checkbox,
	CheckboxControl,
	CheckboxInput,
	CheckboxLabel,
} from "../../../src/components/ui/Checkbox";
import {
	ColorPicker,
	DEFAULT_SWATCHES,
} from "../../../src/components/ui/ColorPicker";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemDeleteTrigger,
	FileFieldItemList,
	FileFieldItemName,
	FileFieldItemSize,
	FileFieldLabel,
	FileFieldTrigger,
} from "../../../src/components/ui/FileField";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemControl,
	RadioGroupItemIndicator,
	RadioGroupItemInput,
	RadioGroupItemLabel,
} from "../../../src/components/ui/RadioGroup";
import {
	Search,
	SearchContent,
	SearchControl,
	SearchItem,
	SearchItemLabel,
	SearchListbox,
	SearchNoResult,
	SearchPortal,
} from "../../../src/components/ui/Search";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPortal,
	SelectTrigger,
	SelectValue,
} from "../../../src/components/ui/Select";
import {
	Slider,
	SliderFill,
	SliderGroup,
	SliderLabel,
	SliderThumb,
	SliderTrack,
	SliderValueLabel,
} from "../../../src/components/ui/Slider";
import {
	Switch,
	SwitchControl,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../../src/components/ui/Switch";
import {
	TextField,
	TextFieldDescription,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "../../../src/components/ui/TextField";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const FRUITS = ["Apple", "Banana", "Cherry", "Dragonfruit", "Elderberry"];

const TextFieldDemo = () => {
	const [name, setName] = createSignal("");
	const [notes, setNotes] = createSignal("");

	return (
		<Demo label="States">
			<div class="flex w-full flex-col gap-4">
				<TextField value={name()} onChange={setName}>
					<TextFieldLabel>Display name</TextFieldLabel>
					<TextFieldInput placeholder="Alice" />
					<TextFieldDescription>
						Shown next to your messages.
					</TextFieldDescription>
				</TextField>
				<TextField value="" validationState="invalid">
					<TextFieldLabel>Handle</TextFieldLabel>
					<TextFieldInput placeholder="alice.example" />
					<TextFieldErrorMessage>
						This handle is already taken.
					</TextFieldErrorMessage>
				</TextField>
				<TextField value={notes()} onChange={setNotes}>
					<TextFieldLabel>Description</TextFieldLabel>
					<TextFieldTextArea placeholder="Tell us about your community." />
				</TextField>
			</div>
		</Demo>
	);
};

const CheckboxDemo = () => {
	const [checked, setChecked] = createSignal(true);

	return (
		<Demo label="States">
			<Checkbox
				class="flex items-center gap-2"
				checked={checked()}
				onChange={setChecked}
			>
				<CheckboxInput />
				<CheckboxControl />
				<CheckboxLabel>Enable notifications</CheckboxLabel>
			</Checkbox>
			<Checkbox class="flex items-center gap-2" disabled>
				<CheckboxInput />
				<CheckboxControl />
				<CheckboxLabel>Disabled option</CheckboxLabel>
			</Checkbox>
		</Demo>
	);
};

const SwitchDemo = () => {
	const [enabled, setEnabled] = createSignal(false);

	return (
		<Demo label="Switch">
			<Switch
				class="flex items-center gap-2"
				checked={enabled()}
				onChange={setEnabled}
			>
				<SwitchInput />
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
				<SwitchLabel>Share presence</SwitchLabel>
			</Switch>
		</Demo>
	);
};

const RadioGroupDemo = () => {
	const [choice, setChoice] = createSignal("first");

	return (
		<Demo label="RadioGroup">
			<RadioGroup
				value={choice()}
				onChange={setChoice}
				class="flex flex-col gap-2"
			>
				<For each={["first", "second", "third"]}>
					{(value) => (
						<RadioGroupItem value={value} class="flex items-center gap-2">
							<RadioGroupItemInput />
							<RadioGroupItemControl>
								<RadioGroupItemIndicator />
							</RadioGroupItemControl>
							<RadioGroupItemLabel>The {value} option</RadioGroupItemLabel>
						</RadioGroupItem>
					)}
				</For>
			</RadioGroup>
		</Demo>
	);
};

const SliderDemo = () => (
	<Demo label="Slider">
		<Slider defaultValue={[40]} maxValue={100} class="w-64">
			<SliderGroup>
				<SliderLabel>Volume</SliderLabel>
				<SliderValueLabel />
			</SliderGroup>
			<SliderTrack>
				<SliderFill />
				<SliderThumb />
			</SliderTrack>
		</Slider>
	</Demo>
);

const SelectDemo = () => {
	const [fruit, setFruit] = createSignal<string | null>("Apple");

	return (
		<Demo label="Select">
			<Select
				options={FRUITS}
				value={fruit()}
				onChange={setFruit}
				itemComponent={(props) => (
					<SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
				)}
			>
				<SelectTrigger class="w-48" aria-label="Fruit">
					<SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
				</SelectTrigger>
				<SelectPortal>
					<SelectContent />
				</SelectPortal>
			</Select>
		</Demo>
	);
};

const SearchDemo = () => {
	const [query, setQuery] = createSignal<Array<string>>(FRUITS);

	return (
		<Demo label="Search">
			<Search<string>
				class="w-64"
				options={query()}
				triggerMode="input"
				placeholder="Search fruit"
				onInputChange={(value) =>
					setQuery(
						FRUITS.filter((entry) =>
							entry.toLowerCase().includes(value.toLowerCase()),
						),
					)
				}
				itemComponent={(props) => (
					<SearchItem item={props.item}>
						<SearchItemLabel>{props.item.rawValue}</SearchItemLabel>
					</SearchItem>
				)}
			>
				<SearchControl aria-label="Fruit search" />
				<SearchPortal>
					<SearchContent>
						<SearchListbox class="m-0" />
						<SearchNoResult>Nothing found.</SearchNoResult>
					</SearchContent>
				</SearchPortal>
			</Search>
		</Demo>
	);
};

const FileFieldDemo = () => (
	<Demo label="FileField">
		<FileField class="items-start" maxFiles={3}>
			<FileFieldLabel>Attachments</FileFieldLabel>
			<FileFieldDropzone class="w-full max-w-sm">
				<FileFieldTrigger>Choose files</FileFieldTrigger>
			</FileFieldDropzone>
			<FileFieldHiddenInput />
			<FileFieldItemList class="w-full max-w-sm">
				{() => (
					<FileFieldItem>
						<FileFieldItemName />
						<FileFieldItemSize />
						<FileFieldItemDeleteTrigger>Remove</FileFieldItemDeleteTrigger>
					</FileFieldItem>
				)}
			</FileFieldItemList>
		</FileField>
	</Demo>
);

const ColorPickerDemo = () => {
	const [color, setColor] = createSignal(DEFAULT_SWATCHES[0]);

	return (
		<Demo label="ColorPicker">
			<ColorPicker
				value={color()}
				onChange={setColor}
				presetColors={DEFAULT_SWATCHES}
			/>
		</Demo>
	);
};

export const FORMS: SandboxCategory = {
	id: "forms",
	title: "Forms",
	items: [
		{ id: "text-field", title: "TextField", component: TextFieldDemo },
		{ id: "checkbox", title: "Checkbox", component: CheckboxDemo },
		{ id: "switch", title: "Switch", component: SwitchDemo },
		{ id: "radio-group", title: "RadioGroup", component: RadioGroupDemo },
		{ id: "slider", title: "Slider", component: SliderDemo },
		{ id: "select", title: "Select", component: SelectDemo },
		{ id: "search", title: "Search", component: SearchDemo },
		{ id: "file-field", title: "FileField", component: FileFieldDemo },
		{ id: "color-picker", title: "ColorPicker", component: ColorPickerDemo },
	],
};
