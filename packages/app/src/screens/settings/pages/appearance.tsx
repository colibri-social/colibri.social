import { AppearanceSettings } from "@colibri-social/ui";
import { useData } from "../../../data/store";

export default function AppearancePage() {
	const data = useData();
	return (
		<AppearanceSettings
			theme={data.preferences.client().theme}
			onThemeChange={(theme) => void data.preferences.setClient({ theme })}
			messagePreviews={data.preferences.client().messagePreviews}
			onMessagePreviewsChange={(show) =>
				void data.preferences.setClient({ messagePreviews: show })
			}
		/>
	);
}
