import { isWebRuntime } from "./environment";
import type { NotificationPermission } from "./types";

export const isPermissionRevoked = (
	enabled: boolean,
	permission: NotificationPermission,
): boolean => enabled && permission === "denied";

export const watchNotificationPermission = (
	onChange: () => void,
): (() => void) => {
	if (!isWebRuntime()) return () => {};
	if (typeof navigator === "undefined" || !navigator.permissions) {
		return () => {};
	}

	let status: PermissionStatus | undefined;
	let cancelled = false;
	const handler = () => onChange();

	navigator.permissions
		.query({ name: "notifications" })
		.then((result) => {
			if (cancelled) return;
			status = result;
			result.addEventListener("change", handler);
		})
		.catch(() => {});

	return () => {
		cancelled = true;
		status?.removeEventListener("change", handler);
	};
};
