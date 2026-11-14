import { createRoot } from "solid-js";
import { DEVICE_KEYS, devicePref } from "./device-prefs";

type CustomRecordExplorer = {
	enabled: boolean;
	template: string;
};

const isCustomRecordExplorer = (
	value: unknown,
): value is CustomRecordExplorer => {
	if (typeof value !== "object" || value === null) return false;

	const candidate = value as Record<string, unknown>;

	return (
		typeof candidate.enabled === "boolean" &&
		typeof candidate.template === "string"
	);
};

let shared: ReturnType<typeof devicePref<CustomRecordExplorer>> | undefined;

export const customRecordExplorer = () => {
	shared ??= createRoot(() =>
		devicePref(
			DEVICE_KEYS.customRecordExplorer,
			{ enabled: false, template: "" },
			isCustomRecordExplorer,
		),
	);

	return shared;
};
