import { setRecordExplorer } from "@colibri-social/ui";
import { createEffect } from "solid-js";
import { useData } from "../data/store";

export const RecordExplorerSync = () => {
	const data = useData();

	createEffect(() =>
		setRecordExplorer(data.preferences.client().recordExplorer),
	);

	return null;
};
