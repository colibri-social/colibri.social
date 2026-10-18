import { classifyThrown, createLogger } from "@colibri-social/lib";
import { DEVICE_KEYS } from "../../data/device-prefs";
import { isActivationKey } from "../notifications/activation";
import type { TauriPort } from "../notifications/tauri-port";
import type { OsActivation } from "../notifications/types";
import { parsePushActivation } from "./activation";
import {
	type PushProvider,
	retirePrevious,
	type StoredValue,
	storedValue,
} from "./types";

export const APNS_ACTIVATION_EVENT = "colibri-notification-activated";

export type ApnsEnvironment = "sandbox" | "production";

type ApnsRegistration = { token: string; environment: ApnsEnvironment };

type ApnsActivation = {
	channelUri?: string | null;
	threadUri?: string | null;
	messageUri?: string | null;
};

const log = createLogger("push");

export const createApnsProvider = (options: {
	port: TauriPort;
	platform: "ios" | "macos";
	token?: StoredValue;
}): PushProvider => {
	const cached = options.token ?? storedValue(DEVICE_KEYS.apnsToken);

	const acquire = async (): Promise<ApnsRegistration | undefined> => {
		try {
			return await options.port.invoke<ApnsRegistration>("apns_register");
		} catch (thrown) {
			log.info(
				"this device can't register for push, using live notifications",
				{
					code: classifyThrown(thrown, { method: "apns_register" }).code,
				},
			);
			return undefined;
		}
	};

	return {
		kind: "apns",
		subscribe: async (api) => {
			const registration = await acquire();
			if (!registration) return false;
			await retirePrevious(cached, registration.token, (token) =>
				api.unregisterPush({ provider: "apns", token }),
			);
			await api.registerPush({
				provider: "apns",
				platform: options.platform,
				token: registration.token,
				environment: registration.environment,
			});
			cached.set(registration.token);
			return true;
		},
		unsubscribe: async (api) => {
			const token = cached.get();
			cached.set(undefined);
			if (token && api) await api.unregisterPush({ provider: "apns", token });
		},
		hasLeftover: async () => cached.get() !== undefined,
		watch: () => () => {},
		dismiss: async (target) => {
			if (!target) return;
			await options.port
				.invoke("apns_remove_delivered", { channelUri: target })
				.catch(() => undefined);
		},
	};
};

export const listenForApnsActivations = (
	port: TauriPort,
	emit: (activation: OsActivation) => void,
): (() => void) => {
	let stopped = false;
	let unlisten: (() => void) | undefined;
	let lastKey: string | undefined;

	const deliver = (payload: ApnsActivation | null | undefined) => {
		if (!payload || isActivationKey(payload.messageUri)) return;
		const key = `${payload.channelUri ?? ""} ${payload.messageUri ?? ""}`;
		if (key === lastKey) return;
		lastKey = key;
		const activation = parsePushActivation(payload);
		if (activation) emit(activation);
	};

	const warn = (method: string) => (thrown: unknown) => {
		log.warn("listening for push taps failed", {
			code: classifyThrown(thrown, { method }).code,
		});
	};

	void port
		.listen<ApnsActivation>(APNS_ACTIVATION_EVENT, ({ payload }) => {
			if (!stopped) deliver(payload);
		})
		.then((stop) => {
			if (stopped) stop();
			else unlisten = stop;
		}, warn("apns.listen"));
	void port
		.invoke<ApnsActivation | null>("apns_take_activation")
		.then((payload) => {
			if (!stopped) deliver(payload);
		}, warn("apns_take_activation"));

	return () => {
		stopped = true;
		unlisten?.();
	};
};
