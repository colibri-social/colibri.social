import { BellIcon } from "@solar-icons/solid/bold/bell";
import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { ListGroup, RadioRow, RadioRowGroup, ToggleRow } from "../List/List";
import { Slider } from "../Slider/Slider";
import {
	isNotificationLevel,
	NOTIFICATION_LEVEL_COPY,
	NOTIFICATION_LEVELS,
	type NotificationLevel,
} from "./types";

export type DeviceNotifications = {
	enabled: boolean;
	onChange: (enabled: boolean) => void;
	blocked?: boolean;
	place?: "browser" | "system";
	busy?: boolean;
};

export type SoundEffectsVolume = {
	volume: number;
	onChange: (volume: number) => void;
	onChangeEnd?: (volume: number) => void;
};

export type NotificationSettingsProps = {
	level: NotificationLevel;
	onLevelChange: (level: NotificationLevel) => void;
	device?: DeviceNotifications;
	sounds?: SoundEffectsVolume;
	class?: string;
};

export const NOTIFICATION_SETTINGS_COPY = {
	level: "Notify me about",
	levelNote: "You can pick a different level for a single Space from its menu.",
	device: "Notifications on this device",
	deviceDescription:
		"Shows notifications while Colibri is in the background or closed.",
	blocked: (place: "browser" | "system") =>
		`Colibri isn't allowed to show notifications. Allow them in your ${place} settings, then turn this on again.`,
	soundVolume: "Sound effects volume",
	soundVolumeDescription:
		"How loud message pings and call sounds like joining, leaving and muting are.",
} as const;

const percent = (value: number) => `${Math.round(value)}%`;

export const NotificationSettings = (props: NotificationSettingsProps) => (
	<div
		data-notification-settings=""
		class={cx("flex w-full min-w-0 flex-col gap-6", props.class)}
	>
		<Show when={props.device}>
			{(device) => (
				<ListGroup>
					<ToggleRow
						icon={<BellIcon />}
						title={NOTIFICATION_SETTINGS_COPY.device}
						description={
							<>
								{NOTIFICATION_SETTINGS_COPY.deviceDescription}
								<Show when={device().blocked}>
									<span
										data-notifications-blocked=""
										class="mt-1 block text-destructive"
									>
										{NOTIFICATION_SETTINGS_COPY.blocked(
											device().place ?? "system",
										)}
									</span>
								</Show>
							</>
						}
						keywords={["push", "alerts"]}
						checked={device().enabled}
						disabled={device().busy}
						onChange={device().onChange}
					/>
				</ListGroup>
			)}
		</Show>
		<Show when={props.sounds}>
			{(sounds) => (
				<Slider
					label={NOTIFICATION_SETTINGS_COPY.soundVolume}
					description={NOTIFICATION_SETTINGS_COPY.soundVolumeDescription}
					showValue
					formatValue={percent}
					minValue={0}
					maxValue={100}
					step={1}
					value={[sounds().volume]}
					onChange={(values) => sounds().onChange(values[0] ?? 0)}
					onChangeEnd={(values) => sounds().onChangeEnd?.(values[0] ?? 0)}
				/>
			)}
		</Show>
		<div class="flex flex-col gap-2">
			<RadioRowGroup
				label={NOTIFICATION_SETTINGS_COPY.level}
				value={props.level}
				onChange={(value) => {
					if (isNotificationLevel(value)) props.onLevelChange(value);
				}}
			>
				<For each={NOTIFICATION_LEVELS}>
					{(level) => (
						<RadioRow
							value={level}
							title={NOTIFICATION_LEVEL_COPY[level].title}
							description={NOTIFICATION_LEVEL_COPY[level].description}
							keywords={["mentions", "replies"]}
						/>
					)}
				</For>
			</RadioRowGroup>
			<p class="m-0 px-1 text-xs text-pretty text-muted-foreground">
				{NOTIFICATION_SETTINGS_COPY.levelNote}
			</p>
		</div>
	</div>
);
