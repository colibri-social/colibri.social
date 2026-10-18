import { PenNewSquareIcon } from "@solar-icons/solid/bold/pen-new-square";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	Show,
} from "solid-js";
import { BlueskyLogo } from "../../icons/animated/brand";
import { ColibriLogo } from "../../icons/brand/ColibriLogo";
import { SelectableCard, SelectableCardGroup } from "./SelectableCard";

export type ProfileSetupSource = "existing" | "bluesky" | "scratch";

export type ProfileSetupOption = {
	value: ProfileSetupSource;
	label: string;
	description?: string;
	icon: () => JSX.Element;
	visible?: boolean;
};

export type ProfileSetupRecords = {
	colibriProfile: boolean;
	blueskyProfile: boolean;
};

export const profileSetupOptions = (
	records: ProfileSetupRecords,
): ProfileSetupOption[] => [
	{
		value: "existing",
		label: "Use existing profile",
		description: "Keep your Colibri name, picture and theme.",
		icon: () => <ColibriLogo size={24} />,
		visible: records.colibriProfile,
	},
	{
		value: "bluesky",
		label: "Import from Bluesky",
		description: "Bring over your Bluesky name and picture.",
		icon: () => <BlueskyLogo />,
		visible: records.blueskyProfile,
	},
	{
		value: "scratch",
		label: "Start from scratch",
		description: "Pick a name and picture yourself.",
		icon: () => <PenNewSquareIcon />,
	},
];

export const visibleProfileSetupOptions = (options: ProfileSetupOption[]) =>
	options.filter((option) => option.visible !== false);

export type ProfileSetupPickerProps = {
	options: ProfileSetupOption[];
	value?: ProfileSetupSource;
	onChange?: (value: ProfileSetupSource) => void;
	"aria-label"?: string;
	class?: string;
};

const ROW_LAYOUT_FROM = 3;

export const ProfileSetupPicker = (props: ProfileSetupPickerProps) => {
	const visible = createMemo(() => visibleProfileSetupOptions(props.options));
	const stacked = () => visible().length >= ROW_LAYOUT_FROM;
	const [internal, setInternal] = createSignal<ProfileSetupSource>();
	const requested = () => props.value ?? internal();
	const value = createMemo(() => {
		const options = visible();
		const wanted = requested();
		if (wanted && options.some((option) => option.value === wanted))
			return wanted;
		return options[0]?.value;
	});

	createEffect(() => {
		const current = value();
		const wanted = requested();
		if (current && wanted !== undefined && current !== wanted)
			props.onChange?.(current);
	});

	return (
		<Show when={visible().length > 0}>
			<SelectableCardGroup
				aria-label={props["aria-label"] ?? "How to set up your profile"}
				value={value() ?? ""}
				orientation={stacked() ? "vertical" : "horizontal"}
				onChange={(next) => {
					const source = next as ProfileSetupSource;
					setInternal(source);
					props.onChange?.(source);
				}}
				class={props.class}
			>
				<For each={visible()}>
					{(option) => (
						<SelectableCard
							value={option.value}
							label={option.label}
							description={stacked() ? option.description : undefined}
							layout={stacked() ? "row" : "tile"}
							icon={option.icon()}
							class="text-balance"
						/>
					)}
				</For>
			</SelectableCardGroup>
		</Show>
	);
};
