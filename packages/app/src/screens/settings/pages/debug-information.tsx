import { DebugInformation, type DiagnosticsSection } from "@colibri-social/ui";
import { createSignal, onMount } from "solid-js";
import { displayNameOf } from "../../../data/adapters/authors";
import {
	collectDiagnostics,
	formatDiagnostics,
} from "../../../data/debug-info";
import { useLiveStatus } from "../../../data/live-context";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";

export default function DebugInformationPage(_props: { platform: Platform }) {
	const data = useData();
	const live = useLiveStatus();
	const [sections, setSections] = createSignal<DiagnosticsSection[]>();
	onMount(() => {
		void collectDiagnostics({
			did: data.viewer.did,
			handle: data.viewer.handle || displayNameOf(data.viewer),
			liveStatus: live?.status(),
			experiments: data.preferences.client().experiments,
		}).then(setSections);
	});
	return (
		<DebugInformation
			sections={sections()}
			copyValue={sections() ? formatDiagnostics(sections() ?? []) : undefined}
		/>
	);
}
