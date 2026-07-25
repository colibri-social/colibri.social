import { isAndroidTauriRuntime } from "./environment";

export type FcmSubscription = {
	platform: "android";
	token: string;
};

const LAST_TOKEN_STORAGE_KEY = "colibri:fcm:last-token";

const loadPlugin = () => import("tauri-plugin-fcm");

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

export const subscribeFcmPush = async (
	register: (sub: FcmSubscription) => Promise<unknown>,
	unregister?: (token: string) => Promise<unknown>,
): Promise<boolean> => {
	if (!(await isAndroidTauriRuntime())) return false;

	const {
		checkPermissions,
		requestPermissions,
		register: registerDevice,
		getToken,
	} = await loadPlugin();

	let permission = await checkPermissions();
	if (permission !== "granted") permission = await requestPermissions();
	if (permission !== "granted") return false;

	await registerDevice();
	const { token } = await getToken();

	const previousToken = readLastToken();
	if (previousToken && previousToken !== token && unregister) {
		try {
			await unregister(previousToken);
		} catch {}
	}

	await register({ platform: "android", token });
	storeLastToken(token);
	return true;
};

export const unsubscribeFcmPush = async (
	unregister: (token: string) => Promise<unknown>,
): Promise<void> => {
	if (!(await isAndroidTauriRuntime())) return;

	const { getToken, deleteToken } = await loadPlugin();
	let token: string | undefined;
	try {
		({ token } = await getToken());
	} catch {
		return;
	}
	await deleteToken();
	storeLastToken(null);
	if (token) await unregister(token);
};

export const listenForFcmTokenRefresh = async (
	onRefresh: (token: string) => void,
): Promise<() => void> => {
	if (!(await isAndroidTauriRuntime())) return () => {};

	const { onTokenRefresh } = await loadPlugin();
	const listener = await onTokenRefresh((event) => onRefresh(event.token));
	return () => {
		void listener.unregister();
	};
};
