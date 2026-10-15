import { AdvancedSettings } from "@colibri-social/ui";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";

export default function AdvancedPage(_props: { platform: Platform }) {
	const data = useData();
	return (
		<AdvancedSettings
			developerMode={data.preferences.client().developerMode}
			onDeveloperModeChange={(enabled) =>
				void data.preferences.setClient({ developerMode: enabled })
			}
		/>
	);
}
