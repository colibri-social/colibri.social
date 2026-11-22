import { AppearanceSettings } from "@colibri-social/ui";
import { hapticsSetting } from "../../../data/haptics-setting";
import { useData } from "../../../data/store";
import {
	hapticsAvailable,
	systemHapticsEnabled,
} from "../../../native/haptics-system";
import type { Platform } from "../../../screen/platform";

export default function AppearancePage(props: { platform: Platform }) {
	const data = useData();
	const [haptics, setHaptics] = hapticsSetting();
	return (
		<AppearanceSettings
			theme={data.preferences.client().theme}
			onThemeChange={(theme) => void data.preferences.setClient({ theme })}
			messagePreviews={data.preferences.client().messagePreviews}
			onMessagePreviewsChange={(show) =>
				void data.preferences.setClient({ messagePreviews: show })
			}
			inboxAsModal={data.preferences.client().inboxPresentation === "modal"}
			onInboxAsModalChange={
				props.platform === "desktop"
					? (modal) =>
							void data.preferences.setClient({
								inboxPresentation: modal ? "modal" : "popover",
							})
					: undefined
			}
			haptics={
				hapticsAvailable()
					? {
							enabled: haptics(),
							deviceDisabled: !systemHapticsEnabled(),
							onChange: setHaptics,
						}
					: undefined
			}
		/>
	);
}
