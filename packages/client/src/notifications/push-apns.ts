import { classifyNativeError } from "../errors/native";
import { createLogger } from "../utils/logger";
import { type AppleTauriPlatform, appleTauriPlatform } from "./environment";

export type ApnsEnvironment = "sandbox" | "production";

export type ApnsSubscription = {
	platform: AppleTauriPlatform;
	token: string;
	environment: ApnsEnvironment;
};

type ApnsRegistration = { token: string; environment: ApnsEnvironment };

const log = createLogger("push");

const LAST_TOKEN_STORAGE_KEY = "colibri:apns:last-token";

const loadCore = () => import("@tauri-apps/api/core");

const readLastToken = (): string | null => {
	try {
		return localStorage.getItem(LAST_TOKEN_STORAGE_KEY);
	} catch {
		return null;
	}
};

const storeLastToken = (token: string | null): void => {
	try {
		if (token === null) localStorage.removeItem(LAST_TOKEN_STORAGE_KEY);
		else localStorage.setItem(LAST_TOKEN_STORAGE_KEY, token);
	} catch {}
};

export const hasCachedApnsToken = (): boolean => readLastToken() !== null;

const acquireApnsRegistration = async (): Promise<
	ApnsRegistration | undefined
> => {
	try {
		const { invoke } = await loadCore();
		return await invoke<ApnsRegistration>("apns_register");
	} catch (err) {
		const failure = classifyNativeError(err, "apns.register");
		log.info("this device can't register for push, using live notifications", {
			code: failure.code,
		});
		return undefined;
	}
};

export const subscribeApnsPush = async (
	register: (sub: ApnsSubscription) => Promise<unknown>,
	unregister?: (token: string) => Promise<unknown>,
): Promise<boolean> => {
	const platform = await appleTauriPlatform();
	if (platform === null) return false;

	const registration = await acquireApnsRegistration();
	if (registration === undefined) return false;

	const previousToken = readLastToken();
	if (previousToken && previousToken !== registration.token && unregister) {
		try {
			await unregister(previousToken);
		} catch {}
	}

	await register({ platform, ...registration });
	storeLastToken(registration.token);
	return true;
};

export const unsubscribeApnsPush = async (
	unregister: (token: string) => Promise<unknown>,
): Promise<void> => {
	if ((await appleTauriPlatform()) === null) return;

	const token = readLastToken();
	storeLastToken(null);
	if (token) await unregister(token);
};

export const removeDeliveredApnsChannel = async (
	channelUri: string,
): Promise<void> => {
	const { invoke } = await loadCore();
	await invoke("apns_remove_delivered", { channelUri });
};
