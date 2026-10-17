import { classifyThrown, createLogger } from "@colibri-social/lib";
import type { TauriPort } from "./tauri-port";
import {
	joinedBody,
	type OsNotifier,
	type OsPermission,
	targetOf,
} from "./types";

const log = createLogger("notifications");

export const notificationId = (value: string): number => {
	let hash = 0;
	for (let index = 0; index < value.length; index++) {
		hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
	}
	return hash;
};

const fromPluginState = (state: unknown): OsPermission => {
	if (state === "granted" || state === true) return "granted";
	if (state === "denied" || state === false) return "denied";
	return "default";
};

export const createPluginNotifier = (port: TauriPort): OsNotifier => ({
	kind: "plugin",
	permission: () =>
		port
			.invoke<boolean | null>("plugin:notification|is_permission_granted")
			.then(fromPluginState, () => "unsupported" as const),
	requestPermission: () =>
		port
			.invoke<string>("plugin:notification|request_permission")
			.then(fromPluginState, () => "denied" as const),
	show: async (notification) => {
		await port
			.invoke("plugin:notification|notify", {
				options: {
					id: notificationId(targetOf(notification)),
					title: notification.title,
					body: joinedBody(notification),
					group: targetOf(notification),
					autoCancel: true,
				},
			})
			.catch((thrown: unknown) =>
				log.warn("a plugin notification failed", {
					code: classifyThrown(thrown, { method: "notification.notify" }).code,
				}),
			);
	},
	dismiss: async (target) => {
		await port
			.invoke("plugin:notification|remove_active", {
				notifications: [{ id: notificationId(target) }],
			})
			.catch(() => undefined);
	},
	clearAll: async () => {
		await port
			.invoke("plugin:notification|remove_active")
			.catch(() => undefined);
	},
	onActivation: () => () => {},
});
