import { createRoot, createSignal } from "solid-js";
import { DEVICE_KEYS, devicePref } from "../../data/device-prefs";
import { osNotifier } from "./index";
import type { OsNotifier, OsPermission } from "./types";

const isBoolean = (value: unknown): value is boolean =>
	typeof value === "boolean";

export const createDeviceNotifications = (
	notifier: () => Promise<OsNotifier>,
) => {
	const [choice, setChoice] = devicePref<boolean | undefined>(
		DEVICE_KEYS.nativeNotifications,
		undefined,
		isBoolean,
	);
	const [answered, setAnswered] = devicePref(
		DEVICE_KEYS.notificationPrompt,
		false,
		isBoolean,
	);
	const [permission, setPermission] = createSignal<OsPermission>("default");
	const [busy, setBusy] = createSignal(false);

	const adopt = (next: OsPermission) => {
		setPermission(next);
		if (next === "granted" && choice() === undefined) setChoice(true);
		if ((next === "denied" || next === "unsupported") && choice())
			setChoice(false);
		return next;
	};

	const refresh = async () => adopt(await (await notifier()).permission());

	const request = async (): Promise<OsPermission> => {
		setBusy(true);
		try {
			const next = await (await notifier()).requestPermission();
			setPermission(next);
			setAnswered(true);
			if (next === "granted") setChoice(true);
			return next;
		} finally {
			setBusy(false);
		}
	};

	const setEnabled = async (enabled: boolean) => {
		if (!enabled) {
			setChoice(false);
			return;
		}
		const next = permission() === "granted" ? "granted" : await request();
		setChoice(next === "granted");
	};

	const watch = () => {
		const onVisible = () => {
			if (document.visibilityState === "visible") void refresh();
		};
		document.addEventListener("visibilitychange", onVisible);
		void refresh();
		return () => document.removeEventListener("visibilitychange", onVisible);
	};

	return {
		enabled: () => choice() === true,
		active: () => choice() === true && permission() === "granted",
		permission,
		busy,
		answered,
		dismissPrompt: () => setAnswered(true),
		refresh,
		request,
		setEnabled,
		watch,
	};
};

export type DeviceNotifications = ReturnType<typeof createDeviceNotifications>;

let shared: DeviceNotifications | undefined;

export const deviceNotifications = (): DeviceNotifications => {
	shared ??= createRoot(() => createDeviceNotifications(osNotifier));
	return shared;
};
