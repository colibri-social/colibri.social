import {
	setCustomRecordExplorerTemplate,
	setRecordExplorer,
} from "@colibri-social/ui";
import { createEffect } from "solid-js";
import { customRecordExplorer } from "../data/custom-record-explorer";
import { useData } from "../data/store";

export const RecordExplorerSync = () => {
	const data = useData();
	const [custom] = customRecordExplorer();

	createEffect(() => setCustomRecordExplorerTemplate(custom().template));

	createEffect(() =>
		setRecordExplorer(
			custom().enabled ? "custom" : data.preferences.client().recordExplorer,
		),
	);

	return null;
};
