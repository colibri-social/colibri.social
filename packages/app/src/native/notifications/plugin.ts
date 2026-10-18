import { classifyThrown, createLogger } from "@colibri-social/lib";
import { readStoredJSON, writeStoredJSON } from "../../data/persist";
import {
	type ActivationBus,
	createActivationBus,
	decodeActivation,
	encodeActivation,
	isActivationKey,
} from "./activation";
import type { TauriPort } from "./tauri-port";
import {
	joinedBody,
	type OsNotifier,
	type OsPermission,
	targetOf,
} from "./types";

const log = createLogger("notifications");

const ACTIVATIONS_KEY = "colibri:plugin-notification-activations";
const MAX_REMEMBERED = 50;

export type PluginAction = {
	actionId?: string | null;
	notification?: {
		id?: number;
		group?: string | null;
		extra?: Record<string, unknown> | null;
	} | null;
};

export type PluginActionListener = (
	handler: (action: PluginAction) => void,
) => Promise<() => void>;

export type LaunchTapReader = () => string | undefined;

type LaunchTapBridge = { takeLaunchTap?: () => string };

export type RememberedActivations = [number, string][];

export type ActivationMemory = {
	remember: (id: number, key: string) => void;
	recall: (id: number) => string | undefined;
};

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

const isRemembered = (value: unknown): value is RememberedActivations =>
	Array.isArray(value) &&
	value.every(
		(entry) =>
			Array.isArray(entry) &&
			typeof entry[0] === "number" &&
			typeof entry[1] === "string",
	);

export const createActivationMemory = (
	load: () => RememberedActivations | undefined,
	save: (entries: RememberedActivations) => void,
): ActivationMemory => {
	const entries = new Map(load() ?? []);
	return {
		remember: (id, key) => {
			entries.delete(id);
			entries.set(id, key);
			while (entries.size > MAX_REMEMBERED) {
				const oldest = entries.keys().next().value;
				if (oldest === undefined) break;
				entries.delete(oldest);
			}
			save([...entries]);
		},
		recall: (id) => entries.get(id),
	};
};

export const storedActivationMemory = (): ActivationMemory =>
	createActivationMemory(
		() => readStoredJSON(ACTIVATIONS_KEY, isRemembered),
		(entries) => writeStoredJSON(ACTIVATIONS_KEY, entries),
	);

const listenToPluginActions: PluginActionListener = async (handler) => {
	const { addPluginListener } = await import("@tauri-apps/api/core");
	const listener = await addPluginListener<PluginAction>(
		"notification",
		"actionPerformed",
		handler,
	);
	return () => {
		void listener.unregister().catch(() => undefined);
	};
};

const readLaunchTap: LaunchTapReader = () =>
	typeof window === "undefined"
		? undefined
		: (
				window as { __colibriNotificationActions?: LaunchTapBridge }
			).__colibriNotificationActions?.takeLaunchTap?.();

const isPluginAction = (value: unknown): value is PluginAction =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as PluginAction).notification === "object";

const parseLaunchTap = (raw: string | undefined): PluginAction | undefined => {
	if (!raw) return undefined;
	try {
		const parsed: unknown = JSON.parse(raw);
		return isPluginAction(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
};

const activationKeyOf = (
	action: PluginAction,
	memory: ActivationMemory,
): string | undefined => {
	const extra = action.notification?.extra?.activation;
	if (typeof extra === "string" && isActivationKey(extra)) return extra;
	const id = action.notification?.id;
	return typeof id === "number" ? memory.recall(id) : undefined;
};

export const createPluginNotifier = (
	port: TauriPort,
	bus: ActivationBus = createActivationBus(),
	listenActions: PluginActionListener = listenToPluginActions,
	memory: ActivationMemory = storedActivationMemory(),
	takeLaunchTap: LaunchTapReader = readLaunchTap,
): OsNotifier => {
	let listening = false;

	const activate = (action: PluginAction) => {
		if (action.actionId && action.actionId !== "tap") return;
		const decoded = decodeActivation(
			activationKeyOf(action, memory),
			action.notification?.group ?? undefined,
		);
		if (decoded) bus.emit(decoded);
	};

	const listen = () => {
		if (listening) return;
		listening = true;
		const launchTap = parseLaunchTap(takeLaunchTap());
		if (launchTap) activate(launchTap);
		void listenActions(activate).catch((thrown: unknown) =>
			log.warn("notification taps can't be followed", {
				code: classifyThrown(thrown, { method: "notification.onAction" }).code,
			}),
		);
	};

	return {
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
			listen();
			const id = notificationId(targetOf(notification));
			const activation = encodeActivation(notification);
			memory.remember(id, activation);
			await port
				.invoke("plugin:notification|notify", {
					options: {
						id,
						title: notification.title,
						body: joinedBody(notification),
						group: targetOf(notification),
						autoCancel: true,
						extra: { activation },
					},
				})
				.catch((thrown: unknown) =>
					log.warn("a plugin notification failed", {
						code: classifyThrown(thrown, { method: "notification.notify" })
							.code,
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
			bus.discard();
			await port
				.invoke("plugin:notification|remove_active")
				.catch(() => undefined);
		},
		onActivation: (handler) => {
			listen();
			return bus.subscribe(handler);
		},
	};
};
