import {
	type HiddenMessageChoice,
	SPACE_NOTIFICATION_COPY,
	type SpaceNotificationChoice,
	SpaceNotificationSettings,
} from "@colibri-social/ui";
import { spaceNotificationPrefs } from "../../../data/notifications";
import {
	canSeeHiddenMessages,
	hiddenMessageChoiceOf,
	hiddenMessageOverrideOf,
} from "../../../data/preferences/moderation";
import { useData } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";

export type NotificationSettingsArgs = {
	space?: CommunityView;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const NOTIFICATION_SETTINGS_COPY = {
	title: SPACE_NOTIFICATION_COPY.title,
} as const;

export const notificationSettings = defineContract({
	id: "notification-settings",
	model: (args: NotificationSettingsArgs) => {
		const data = useData();
		const prefs = spaceNotificationPrefs(data);
		const did = () => args.space?.did;
		return {
			args,
			name: () => args.space?.name ?? "",
			choice: (): SpaceNotificationChoice => {
				const current = did();
				return (current && prefs.ownLevel(current)) || "default";
			},
			defaultLevel: () => data.preferences.notificationLevel(),
			setChoice: (choice: SpaceNotificationChoice) => {
				const current = did();
				if (current)
					prefs.setLevel(current, choice === "default" ? undefined : choice);
			},
			muted: () => {
				const current = did();
				return current ? prefs.isMuted(current) : false;
			},
			setMuted: (next: boolean) => {
				const current = did();
				if (current) prefs.setMuted(current, next);
			},
			hiddenMessages: (): HiddenMessageChoice | undefined => {
				const current = did();
				if (!current || !canSeeHiddenMessages(args.space)) return undefined;
				return hiddenMessageChoiceOf(data.preferences.spaceModeration(current));
			},
			defaultHidesMessages: () =>
				data.preferences.client().hideModeratedMessages,
			setHiddenMessages: (choice: HiddenMessageChoice) => {
				const current = did();
				if (current)
					void data.preferences.setSpaceModeration(
						current,
						hiddenMessageOverrideOf(choice),
					);
			},
		};
	},
	slots: {
		Settings: slot((m) => (
			<SpaceNotificationSettings
				level={m.choice()}
				defaultLevel={m.defaultLevel()}
				onLevelChange={m.setChoice}
				muted={m.muted()}
				onMutedChange={m.setMuted}
				hiddenMessages={m.hiddenMessages()}
				defaultHidesMessages={m.defaultHidesMessages()}
				onHiddenMessagesChange={m.setHiddenMessages}
			/>
		)),
	},
});
