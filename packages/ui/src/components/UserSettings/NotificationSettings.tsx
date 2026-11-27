import { BellIcon } from "@solar-icons/solid/bold/bell";
import { PlayIcon } from "@solar-icons/solid/bold/play";
import { createUniqueId, For, Index, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { IconButton } from "../IconButton/IconButton";
import {
	ListGroup,
	RadioRow,
	RadioRowGroup,
	SectionLabel,
	ToggleRow,
} from "../List/List";
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

export type SoundVolumeGroupId = "ping" | "presence" | "mic" | "video";

export type SoundVolumeGroup = {
	id: SoundVolumeGroupId;
	label: string;
	volume: number;
	onChange: (volume: number) => void;
	onChangeEnd?: (volume: number) => void;
	onPreview?: () => void;
};

export type SoundEffectsVolume = {
	groups: SoundVolumeGroup[];
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
	preview: (label: string) => {
		return `Preview ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
	},
} as const;

export const SOUND_VOLUME_GROUPS = [
	{ id: "ping", label: "Notification ping" },
	{ id: "presence", label: "Join and leave" },
	{ id: "mic", label: "Mute and deafen" },
	{ id: "video", label: "Camera and screen share" },
] as const satisfies readonly {
	id: SoundVolumeGroupId;
	label: string;
}[];

const percent = (value: number) => `${Math.round(value)}%`;

export const NotificationSettings = (props: NotificationSettingsProps) => {
	const soundsHeadingId = createUniqueId();

	return (
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
					<section
						data-sound-volumes=""
						aria-labelledby={soundsHeadingId}
						class="flex w-full min-w-0 flex-col gap-4"
					>
						<SectionLabel
							id={soundsHeadingId}
							label={NOTIFICATION_SETTINGS_COPY.soundVolume}
						/>
						<Index each={sounds().groups}>
							{(group) => (
								<div
									data-sound-volume={group().id}
									class="flex w-full min-w-0 items-end gap-3"
								>
									<Slider
										class="min-w-0 flex-1"
										label={group().label}
										showValue
										formatValue={percent}
										minValue={0}
										maxValue={100}
										step={1}
										value={[group().volume]}
										onChange={(values) => group().onChange(values[0] ?? 0)}
										onChangeEnd={(values) =>
											group().onChangeEnd?.(values[0] ?? 0)
										}
									/>
									<IconButton
										variant="ghost"
										size="md"
										class="-mb-1"
										icon={<PlayIcon />}
										label={NOTIFICATION_SETTINGS_COPY.preview(group().label)}
										disabled={!group().onPreview}
										onClick={() => group().onPreview?.()}
									/>
								</div>
							)}
						</Index>
					</section>
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
};
