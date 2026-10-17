import { AdvancedSettings } from "@colibri-social/ui";
import { createResource } from "solid-js";
import { reportAttribution } from "../../../data/report-attribution";
import { useData } from "../../../data/store";
import {
	checkForUpdates,
	restartToApply,
	updaterSupported,
	updateState,
} from "../../../native/updater";
import type { Platform } from "../../../screen/platform";
import { sentryActive } from "../../../sentry/init";
import { useSettingsNav } from "../nav";

const appVersion = async () => {
	try {
		const { getVersion } = await import("@tauri-apps/api/app");
		return await getVersion();
	} catch {
		return undefined;
	}
};

export default function AdvancedPage(_props: { platform: Platform }) {
	const data = useData();
	const nav = useSettingsNav();
	const [includeAccount, setIncludeAccount] = reportAttribution();
	const [version] = createResource(
		() => updaterSupported() || undefined,
		appVersion,
	);
	const updates = () => {
		const current = version();
		if (!updaterSupported() || !current) return undefined;
		return {
			version: current,
			state: updateState(),
			onCheck: () => void checkForUpdates(),
			onRestart: () => void restartToApply(),
		};
	};
	return (
		<AdvancedSettings
			updates={updates()}
			developerMode={data.preferences.client().developerMode}
			onDeveloperModeChange={(enabled) =>
				void data.preferences.setClient({ developerMode: enabled })
			}
			includeAccountInReports={sentryActive() ? includeAccount() : undefined}
			onIncludeAccountInReportsChange={setIncludeAccount}
			onDeleteAccount={() => nav.open("deleteAccount")}
		/>
	);
}
