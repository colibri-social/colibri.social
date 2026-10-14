import {
	ListGroup,
	RadioRow,
	RadioRowGroup,
	ToggleRow,
} from "@colibri-social/ui";
import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { For } from "solid-js";
import {
	type SpaceNotificationLevel,
	spaceNotificationPrefs,
} from "../../../data/notifications";
import { useData } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";

export type NotificationSettingsArgs = {
	space?: CommunityView;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const NOTIFICATION_SETTINGS_COPY = {
	title: "Notification settings",
	level: "Notify me about",
	levels: [
		{
			value: "all",
			title: "All messages",
			description: "Every new message in this Space.",
		},
		{
			value: "mentionsAndReplies",
			title: "Mentions and replies",
			description: "Only when someone mentions you or replies to you.",
		},
		{
			value: "nothing",
			title: "Nothing",
			description: "No notifications from this Space.",
		},
	] as const satisfies readonly {
		value: SpaceNotificationLevel;
		title: string;
		description: string;
	}[],
	mute: "Mute this Space",
	muteDescription: "Hides unread markers and mention counts for this Space.",
} as const;

const isLevel = (value: string): value is SpaceNotificationLevel =>
	NOTIFICATION_SETTINGS_COPY.levels.some((entry) => entry.value === value);

export const notificationSettings = defineContract({
	id: "notification-settings",
	model: (args: NotificationSettingsArgs) => {
		const prefs = spaceNotificationPrefs(useData());
		const did = () => args.space?.did;
		return {
			args,
			name: () => args.space?.name ?? "",
			level: () => {
				const current = did();
				return current ? prefs.level(current) : undefined;
			},
			setLevel: (value: string) => {
				const current = did();
				if (current && isLevel(value)) prefs.setLevel(current, value);
			},
			muted: () => {
				const current = did();
				return current ? prefs.isMuted(current) : false;
			},
			setMuted: (next: boolean) => {
				const current = did();
				if (current) prefs.setMuted(current, next);
			},
		};
	},
	slots: {
		Level: slot((m) => (
			<RadioRowGroup
				label={NOTIFICATION_SETTINGS_COPY.level}
				value={m.level()}
				onChange={m.setLevel}
			>
				<For each={NOTIFICATION_SETTINGS_COPY.levels}>
					{(entry) => (
						<RadioRow
							value={entry.value}
							title={entry.title}
							description={entry.description}
						/>
					)}
				</For>
			</RadioRowGroup>
		)),
		Mute: slot((m) => (
			<ListGroup>
				<ToggleRow
					icon={<BellOffIcon />}
					title={NOTIFICATION_SETTINGS_COPY.mute}
					description={NOTIFICATION_SETTINGS_COPY.muteDescription}
					checked={m.muted()}
					onChange={m.setMuted}
				/>
			</ListGroup>
		)),
	},
});
