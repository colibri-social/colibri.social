import { isTauriRuntime } from "../notifications/environment";
import { isDesktopNative } from "../utils/platform";

const BEFORE_EXIT_EVENT = "colibri-before-exit";

let installed = false;
let activeSub: string | undefined;

const waitForTokenRefresh = async (): Promise<void> => {
	const sub = activeSub;
	if (!sub || typeof navigator === "undefined" || !navigator.locks?.request) {
		return;
	}
	await navigator.locks.request(`@atproto-oauth-client-${sub}`, () => {});
};

export const installQuitGuard = (sub: string | undefined): void => {
	activeSub = sub;
	if (installed || !isTauriRuntime() || !isDesktopNative()) return;
	installed = true;

	void (async () => {
		const [{ listen }, { invoke }] = await Promise.all([
			import("@tauri-apps/api/event"),
			import("@tauri-apps/api/core"),
		]);
		await listen(BEFORE_EXIT_EVENT, async () => {
			try {
				await waitForTokenRefresh();
			} finally {
				await invoke("ready_to_exit");
			}
		});
	})().catch(() => {
		installed = false;
	});
};
