import { NotificationSettings, SOUND_VOLUME_GROUPS } from "@colibri-social/ui";
import { createSignal, onCleanup } from "solid-js";
import { previewSoundGroup } from "../../../data/notification-sounds";
import type { SoundGroup, SoundVolumes } from "../../../data/preferences/types";
import { useData } from "../../../data/store";
import { deviceNotifications } from "../../../native/notifications/device";
import {
	type OsNotifier,
	osNotifier,
} from "../../../native/notifications/index";

export default function NotificationsPage() {
	const data = useData();
	const device = deviceNotifications();
	const [notifier, setNotifier] = createSignal<OsNotifier>();
	void osNotifier().then(setNotifier);
	onCleanup(device.watch());
	const [drafts, setDrafts] = createSignal<Partial<SoundVolumes>>({});

	const volumeOf = (group: SoundGroup) => {
		return drafts()[group] ?? data.preferences.client().soundVolumes[group];
	};

	const draftVolume = (group: SoundGroup, volume: number) => {
		setDrafts((current) => ({ ...current, [group]: volume }));
	};

	const commitVolume = (group: SoundGroup, volume: number) => {
		void data.preferences.setClient({
			soundVolumes: { [group]: Math.round(volume) },
		});

		setDrafts(({ [group]: _, ...rest }) => rest);
	};

	const soundGroups = () => {
		return SOUND_VOLUME_GROUPS.map(({ id, label }) => ({
			id,
			label,
			volume: volumeOf(id),
			onChange: (volume: number) => draftVolume(id, volume),
			onChangeEnd: (volume: number) => commitVolume(id, volume),
			onPreview: () => previewSoundGroup(id, volumeOf(id)),
		}));
	};

	const supported = () => {
		const kind = notifier()?.kind;
		return !!kind && kind !== "none";
	};
	return (
		<NotificationSettings
			level={data.preferences.notificationLevel()}
			onLevelChange={(level) =>
				void data.preferences.setNotificationLevel(level)
			}
			sounds={{ groups: soundGroups() }}
			device={
				supported()
					? {
							enabled: device.enabled(),
							onChange: (enabled) => void device.setEnabled(enabled),
							blocked: device.permission() === "denied",
							place: notifier()?.kind === "web" ? "browser" : "system",
							busy: device.busy(),
						}
					: undefined
			}
		/>
	);
}
