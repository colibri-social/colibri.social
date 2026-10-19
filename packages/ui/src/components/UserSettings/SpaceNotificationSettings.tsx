import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { ListGroup, RadioRow, RadioRowGroup, ToggleRow } from "../List/List";
import {
	isNotificationLevel,
	NOTIFICATION_LEVEL_COPY,
	NOTIFICATION_LEVELS,
	type NotificationLevel,
} from "./types";

export type SpaceNotificationChoice = NotificationLevel | "default";

export const HIDDEN_MESSAGE_CHOICES = ["default", "show", "hide"] as const;

export type HiddenMessageChoice = (typeof HIDDEN_MESSAGE_CHOICES)[number];

const isHiddenMessageChoice = (value: string): value is HiddenMessageChoice =>
	(HIDDEN_MESSAGE_CHOICES as readonly string[]).includes(value);

export type SpaceNotificationSettingsProps = {
	level: SpaceNotificationChoice;
	defaultLevel: NotificationLevel;
	onLevelChange: (level: SpaceNotificationChoice) => void;
	muted: boolean;
	onMutedChange: (muted: boolean) => void;
	hiddenMessages?: HiddenMessageChoice;
	defaultHidesMessages?: boolean;
	onHiddenMessagesChange?: (choice: HiddenMessageChoice) => void;
	class?: string;
};

export const HIDDEN_MESSAGES_COPY = {
	setting: "Show hidden messages",
	settingDescription:
		"See messages that moderators hid in the Spaces you moderate. Turn this off to keep them out of your channels.",
	group: "Moderation",
	label: "Hidden messages",
	followDefault: "Follow my default",
	followDefaultDescription: (hides: boolean) =>
		`Uses your chat setting, currently ${hides ? "hidden" : "shown"}.`,
	show: "Show",
	showDescription: "See messages that moderators hid in this Space.",
	hide: "Hide",
	hideDescription: "Keep messages that moderators hid out of view.",
} as const;

const SPACE_LEVEL_DESCRIPTION: Record<NotificationLevel, string> = {
	all: "Every new message in this Space.",
	mentionsAndReplies: "Only when someone mentions you or replies to you.",
	nothing: "No notifications from this Space.",
};

export const SPACE_NOTIFICATION_COPY = {
	title: "Space settings",
	level: "Notify me about",
	followDefault: "Follow my default",
	followDefaultDescription: (level: NotificationLevel) =>
		`Uses your notification setting, currently ${NOTIFICATION_LEVEL_COPY[level].title.toLowerCase()}.`,
	mute: "Mute this Space",
	muteDescription: "Hides unread markers and mention counts for this Space.",
} as const;

export const SpaceNotificationSettings = (
	props: SpaceNotificationSettingsProps,
) => (
	<div
		data-space-notification-settings=""
		class={cx("flex w-full min-w-0 flex-col gap-4", props.class)}
	>
		<RadioRowGroup
			label={SPACE_NOTIFICATION_COPY.level}
			value={props.level}
			onChange={(value) => {
				if (value === "default" || isNotificationLevel(value))
					props.onLevelChange(value);
			}}
		>
			<RadioRow
				value="default"
				title={SPACE_NOTIFICATION_COPY.followDefault}
				description={SPACE_NOTIFICATION_COPY.followDefaultDescription(
					props.defaultLevel,
				)}
			/>
			<For each={NOTIFICATION_LEVELS}>
				{(level) => (
					<RadioRow
						value={level}
						title={NOTIFICATION_LEVEL_COPY[level].title}
						description={SPACE_LEVEL_DESCRIPTION[level]}
					/>
				)}
			</For>
		</RadioRowGroup>
		<ListGroup>
			<ToggleRow
				icon={<BellOffIcon />}
				title={SPACE_NOTIFICATION_COPY.mute}
				description={SPACE_NOTIFICATION_COPY.muteDescription}
				checked={props.muted}
				onChange={props.onMutedChange}
			/>
		</ListGroup>
		<Show when={props.hiddenMessages}>
			{(choice) => (
				<RadioRowGroup
					label={HIDDEN_MESSAGES_COPY.label}
					aria-label={HIDDEN_MESSAGES_COPY.label}
					value={choice()}
					onChange={(value) => {
						if (isHiddenMessageChoice(value))
							props.onHiddenMessagesChange?.(value);
					}}
				>
					<RadioRow
						value="default"
						title={HIDDEN_MESSAGES_COPY.followDefault}
						description={HIDDEN_MESSAGES_COPY.followDefaultDescription(
							props.defaultHidesMessages ?? false,
						)}
					/>
					<RadioRow
						value="show"
						title={HIDDEN_MESSAGES_COPY.show}
						description={HIDDEN_MESSAGES_COPY.showDescription}
					/>
					<RadioRow
						value="hide"
						title={HIDDEN_MESSAGES_COPY.hide}
						description={HIDDEN_MESSAGES_COPY.hideDescription}
					/>
				</RadioRowGroup>
			)}
		</Show>
	</div>
);
