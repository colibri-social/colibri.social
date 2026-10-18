import { deviceString } from "../../data/device-prefs";
import type { DataSource } from "../../data/source";
import type { TauriPort } from "../notifications/tauri-port";

export type PushApi = Pick<DataSource, "registerPush" | "unregisterPush">;

export type PushProviderKind = "apns" | "fcm" | "web";

export type PushProvider = {
	kind: PushProviderKind;
	subscribe: (api: PushApi) => Promise<boolean>;
	unsubscribe: (api?: PushApi) => Promise<void>;
	hasLeftover: () => Promise<boolean>;
	watch: (onChange: () => void) => () => void;
	dismiss: (target: string | undefined) => Promise<void>;
};

export type PushPort = TauriPort & {
	pluginListener: (
		plugin: string,
		event: string,
		handler: (payload: unknown) => void,
	) => Promise<() => void>;
};

export type StoredValue = {
	get: () => string | undefined;
	set: (value: string | undefined) => void;
};

export const storedValue = (key: string): StoredValue => {
	const [value, setValue] = deviceString(key);
	return { get: value, set: setValue };
};

export const retirePrevious = async (
	cached: StoredValue,
	next: string,
	unregister: (previous: string) => Promise<unknown>,
): Promise<void> => {
	const previous = cached.get();
	if (!previous || previous === next) return;
	await unregister(previous).catch(() => undefined);
};
