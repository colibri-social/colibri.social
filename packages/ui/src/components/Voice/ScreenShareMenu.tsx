import { AltArrowDownIcon } from "@solar-icons/solid/linear/alt-arrow-down";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import {
	DropdownMenu,
	type DropdownMenuEntry,
} from "../DropdownMenu/DropdownMenu";
import {
	SCREEN_SHARE_FRAMERATES,
	SCREEN_SHARE_RESOLUTIONS,
	type ScreenShareFramerate,
	type ScreenShareResolution,
	type ScreenShareSettings,
	screenShareFramerateLabel,
	screenShareResolutionLabel,
} from "../SettingsPages/VoiceVideoSettings";

export type ScreenShareMenuProps = {
	settings: ScreenShareSettings;
	onSettingsChange: (patch: Partial<ScreenShareSettings>) => void;
	sharing?: boolean;
};

export const SCREEN_SHARE_MENU_COPY = {
	label: "Screen share settings",
	resolution: "Resolution",
	framerate: "Frame rate",
	sound: "Share sound",
	soundLocked: "Sound (restart to change)",
} as const;

export const screenShareMenuEntries = (
	props: ScreenShareMenuProps,
): DropdownMenuEntry[] => [
	{
		kind: "radio",
		label: SCREEN_SHARE_MENU_COPY.resolution,
		value: props.settings.resolution,
		onChange: (value) =>
			props.onSettingsChange({ resolution: value as ScreenShareResolution }),
		options: SCREEN_SHARE_RESOLUTIONS.map((resolution) => ({
			value: resolution,
			label: screenShareResolutionLabel(resolution),
		})),
	},
	{ kind: "separator" },
	{
		kind: "radio",
		label: SCREEN_SHARE_MENU_COPY.framerate,
		value: String(props.settings.framerate),
		onChange: (value) =>
			props.onSettingsChange({
				framerate: Number(value) as ScreenShareFramerate,
			}),
		options: SCREEN_SHARE_FRAMERATES.map((framerate) => ({
			value: String(framerate),
			label: screenShareFramerateLabel(framerate),
		})),
	},
	...(props.settings.shareAudio === undefined
		? []
		: ([
				{ kind: "separator" },
				{
					kind: "checkbox",
					label: props.sharing
						? SCREEN_SHARE_MENU_COPY.soundLocked
						: SCREEN_SHARE_MENU_COPY.sound,
					checked: props.settings.shareAudio,
					disabled: props.sharing,
					onChange: (checked) =>
						props.onSettingsChange({ shareAudio: checked }),
				},
			] satisfies DropdownMenuEntry[])),
];

export const ScreenShareMenu = (props: ScreenShareMenuProps) => (
	<DropdownMenu
		label={SCREEN_SHARE_MENU_COPY.label}
		placement="top-end"
		items={screenShareMenuEntries(props)}
		trigger={<AltArrowDownIcon />}
		triggerProps={{ "data-screen-share-menu": "" }}
		triggerClass={cx(
			"pressable absolute -right-1 -bottom-1 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-secondary p-0 text-foreground outline-none focus-ring",
			"hover:bg-secondary-highlight aria-expanded:bg-secondary-highlight [&_svg]:size-3.5",
		)}
	/>
);

export type ScreenShareControlProps = {
	menu?: ScreenShareMenuProps;
	stretch?: boolean;
	children: JSX.Element;
};

export const ScreenShareControl = (props: ScreenShareControlProps) => (
	<span
		data-screen-share-control=""
		class={cx("relative inline-flex", props.stretch && "w-full")}
	>
		{props.children}
		<Show when={props.menu}>{(menu) => <ScreenShareMenu {...menu()} />}</Show>
	</span>
);
