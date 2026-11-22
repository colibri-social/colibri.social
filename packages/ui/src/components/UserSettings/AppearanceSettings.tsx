import { MonitorSmartphoneIcon } from "@solar-icons/solid/bold/monitor-smartphone";
import { MoonIcon } from "@solar-icons/solid/bold/moon";
import { SunIcon } from "@solar-icons/solid/bold/sun";
import { For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { ListGroup, RadioRow, RadioRowGroup, ToggleRow } from "../List/List";
import type { ThemePreference } from "./types";

export type AppearanceSettingsProps = {
	theme: ThemePreference;
	onThemeChange: (theme: ThemePreference) => void;
	messagePreviews: boolean;
	onMessagePreviewsChange: (show: boolean) => void;
	inboxAsModal?: boolean;
	onInboxAsModalChange?: (modal: boolean) => void;
	haptics?: {
		enabled: boolean;
		deviceDisabled: boolean;
		onChange: (enabled: boolean) => void;
	};
	class?: string;
};

const THEMES: {
	value: ThemePreference;
	title: string;
	description?: string;
	icon: () => JSX.Element;
}[] = [
	{
		value: "system",
		title: "Match my device",
		description: "Switches between dark and light along with your device.",
		icon: () => <MonitorSmartphoneIcon />,
	},
	{ value: "dark", title: "Dark", icon: () => <MoonIcon /> },
	{ value: "light", title: "Light", icon: () => <SunIcon /> },
];

const isTheme = (value: string): value is ThemePreference =>
	THEMES.some((theme) => theme.value === value);

export const APPEARANCE_SETTINGS_COPY = {
	theme: "Theme",
	previews: "Channels",
	messagePreviews: "Show message previews",
	messagePreviewsDescription:
		"Shows the latest message under each channel name.",
	feedback: "Feedback",
	haptics: "Haptics",
	hapticsDescription:
		"Vibrate on taps, drags and alerts. Follows your device's touch feedback setting.",
	hapticsDeviceDisabledDescription:
		"Touch feedback is off in your device settings, so Colibri won't vibrate.",
	inbox: "Inbox",
	inboxAsModal: "Open the Inbox in a large window",
	inboxAsModalDescription:
		"Shows the Inbox in the middle of the screen instead of next to the Inbox button.",
} as const;

export const AppearanceSettings = (props: AppearanceSettingsProps) => (
	<div
		data-appearance-settings=""
		class={cx("flex w-full min-w-0 flex-col gap-6", props.class)}
	>
		<RadioRowGroup
			label={APPEARANCE_SETTINGS_COPY.theme}
			value={props.theme}
			onChange={(value) => {
				if (isTheme(value)) props.onThemeChange(value);
			}}
		>
			<For each={THEMES}>
				{(theme) => (
					<RadioRow
						value={theme.value}
						icon={theme.icon()}
						title={theme.title}
						description={theme.description}
						keywords={["theme", "mode", "dark", "light"]}
					/>
				)}
			</For>
		</RadioRowGroup>
		<ListGroup label={APPEARANCE_SETTINGS_COPY.previews}>
			<ToggleRow
				title={APPEARANCE_SETTINGS_COPY.messagePreviews}
				description={APPEARANCE_SETTINGS_COPY.messagePreviewsDescription}
				checked={props.messagePreviews}
				onChange={props.onMessagePreviewsChange}
			/>
		</ListGroup>
		<Show when={props.haptics}>
			{(haptics) => (
				<ListGroup label={APPEARANCE_SETTINGS_COPY.feedback}>
					<ToggleRow
						title={APPEARANCE_SETTINGS_COPY.haptics}
						description={
							haptics().deviceDisabled
								? APPEARANCE_SETTINGS_COPY.hapticsDeviceDisabledDescription
								: APPEARANCE_SETTINGS_COPY.hapticsDescription
						}
						keywords={["haptics", "vibration", "touch feedback"]}
						checked={!haptics().deviceDisabled && haptics().enabled}
						disabled={haptics().deviceDisabled}
						onChange={(enabled) => haptics().onChange(enabled)}
					/>
				</ListGroup>
			)}
		</Show>
		<Show when={props.onInboxAsModalChange}>
			{(onChange) => (
				<ListGroup label={APPEARANCE_SETTINGS_COPY.inbox}>
					<ToggleRow
						title={APPEARANCE_SETTINGS_COPY.inboxAsModal}
						description={APPEARANCE_SETTINGS_COPY.inboxAsModalDescription}
						checked={props.inboxAsModal ?? false}
						onChange={(modal) => onChange()(modal)}
					/>
				</ListGroup>
			)}
		</Show>
	</div>
);
