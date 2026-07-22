import { isAndroidTauriRuntime } from "./environment";

export type FcmSubscription = {
	platform: "android";
	token: string;
};

const loadPlugin = () => import("tauri-plugin-fcm");

export const subscribeFcmPush = async (
	register: (sub: FcmSubscription) => Promise<unknown>,
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
	await register({ platform: "android", token });
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
