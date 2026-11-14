import {
	AdvancedSettings,
	type RecordExplorerChoice,
} from "@colibri-social/ui";
import { createResource } from "solid-js";
import { customRecordExplorer } from "../../../data/custom-record-explorer";
import { reportAttribution } from "../../../data/report-attribution";
import { useData } from "../../../data/store";
import { systemWindowControls } from "../../../data/system-window-controls";
import {
	checkForUpdates,
	restartToApply,
	updaterSupported,
	updateState,
} from "../../../native/updater";
import type { Platform } from "../../../screen/platform";
import { sentryActive } from "../../../sentry/init";
import {
	fixedFrame,
	nativeWindow,
	resolveChromeMode,
} from "../../../shell/desktop/window-chrome";
import { useSettingsNav } from "../nav";

const appVersion = async () => {
	try {
		const { getVersion } = await import("@tauri-apps/api/app");
		return await getVersion();
	} catch {
		return undefined;
	}
};

export default function AdvancedPage(props: { platform: Platform }) {
	const data = useData();
	const nav = useSettingsNav();
	const [includeAccount, setIncludeAccount] = reportAttribution();
	const [systemControls, setSystemControls] = systemWindowControls();
	const [customExplorer, setCustomExplorer] = customRecordExplorer();
	const changeRecordExplorer = (explorer: RecordExplorerChoice) => {
		if (explorer === "custom") {
			setCustomExplorer({ ...customExplorer(), enabled: true });

			return;
		}

		setCustomExplorer({ ...customExplorer(), enabled: false });

		void data.preferences.setClient({ recordExplorer: explorer });
	};
	const changeSystemControls = (enabled: boolean) => {
		setSystemControls(enabled);
		void nativeWindow.setSystemControls(enabled);
	};
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
			recordExplorer={
				customExplorer().enabled
					? "custom"
					: data.preferences.client().recordExplorer
			}
			onRecordExplorerChange={changeRecordExplorer}
			customExplorerTemplate={customExplorer().template}
			onCustomExplorerTemplateSave={(template) =>
				setCustomExplorer({ ...customExplorer(), template })
			}
			platform={props.platform}
			includeAccountInReports={sentryActive() ? includeAccount() : undefined}
			onIncludeAccountInReportsChange={setIncludeAccount}
			systemWindowControls={
				resolveChromeMode() === "none" || fixedFrame()
					? undefined
					: systemControls()
			}
			onSystemWindowControlsChange={changeSystemControls}
			onDeleteAccount={() => nav.open("deleteAccount")}
		/>
	);
}
