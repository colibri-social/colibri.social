import { AdvancedSettings } from "@colibri-social/ui";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import { useSettingsNav } from "../nav";

export default function AdvancedPage(_props: { platform: Platform }) {
	const data = useData();
	const nav = useSettingsNav();
	return (
		<AdvancedSettings
			developerMode={data.preferences.client().developerMode}
			onDeveloperModeChange={(enabled) =>
				void data.preferences.setClient({ developerMode: enabled })
			}
			onDeleteAccount={() => nav.open("deleteAccount")}
		/>
	);
}
