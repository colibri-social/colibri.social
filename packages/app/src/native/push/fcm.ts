import { classifyThrown, createLogger } from "@colibri-social/lib";
import { DEVICE_KEYS } from "../../data/device-prefs";
import {
	type PushPort,
	type PushProvider,
	retirePrevious,
	type StoredValue,
	storedValue,
} from "./types";

const log = createLogger("push");

export const createFcmProvider = (options: {
	port: PushPort;
	token?: StoredValue;
}): PushProvider => {
	const cached = options.token ?? storedValue(DEVICE_KEYS.fcmToken);

	const acquire = async (): Promise<string | undefined> => {
		try {
			const result = await options.port.invoke<{ token?: string } | null>(
				"plugin:fcm|get_token",
			);
			return result?.token || undefined;
		} catch (thrown) {
			log.info(
				"this device can't register for push, using live notifications",
				{
					code: classifyThrown(thrown, { method: "fcm.get_token" }).code,
				},
			);
			return undefined;
		}
	};

	const deleteLocal = () =>
		options.port.invoke("plugin:fcm|delete_token").catch((thrown: unknown) => {
			log.warn("removing the push token failed", {
				code: classifyThrown(thrown, { method: "fcm.delete_token" }).code,
			});
		});

	return {
		kind: "fcm",
		subscribe: async (api) => {
			const token = await acquire();
			if (!token) return false;
			await retirePrevious(cached, token, (previous) =>
				api.unregisterPush({ provider: "fcm", token: previous }),
			);
			await api.registerPush({ provider: "fcm", platform: "android", token });
			cached.set(token);
			return true;
		},
		unsubscribe: async (api) => {
			const token = cached.get();
			cached.set(undefined);
			try {
				if (token && api) await api.unregisterPush({ provider: "fcm", token });
			} finally {
				await deleteLocal();
			}
		},
		hasLeftover: async () => cached.get() !== undefined,
		watch: (onChange) => {
			let stopped = false;
			let stop: (() => void) | undefined;
			void options.port
				.pluginListener("fcm", "token-refresh", () => {
					if (!stopped) onChange();
				})
				.then(
					(release) => {
						if (stopped) release();
						else stop = release;
					},
					(thrown: unknown) => {
						log.warn("watching for push token changes failed", {
							code: classifyThrown(thrown, { method: "fcm.token-refresh" })
								.code,
						});
					},
				);
			return () => {
				stopped = true;
				stop?.();
			};
		},
		dismiss: async () => {},
	};
};
