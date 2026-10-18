import { createRoot } from "solid-js";
import { DEVICE_KEYS, devicePref } from "./device-prefs";

const isBoolean = (value: unknown): value is boolean =>
	typeof value === "boolean";

let shared: ReturnType<typeof devicePref<boolean>> | undefined;

export const systemWindowControls = () => {
	shared ??= createRoot(() =>
		devicePref(DEVICE_KEYS.systemWindowControls, false, isBoolean),
	);
	return shared;
};
