import { ExperimentsSettings } from "@colibri-social/ui";
import { experimentViews, setExperiment } from "../../../data/experiments";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";

export default function ExperimentsPage(_props: { platform: Platform }) {
	const data = useData();
	return (
		<ExperimentsSettings
			experiments={experimentViews(data.preferences.client().experiments)}
			onExperimentChange={(id, enabled) =>
				void setExperiment(data.preferences, id, enabled)
			}
		/>
	);
}
