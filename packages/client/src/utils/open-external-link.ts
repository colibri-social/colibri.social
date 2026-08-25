import { isTauriRuntime } from "../notifications/environment";

export const openExternalLink = (
	url: string | undefined,
	event?: { preventDefault: () => void },
): void => {
	if (!url || !isTauriRuntime()) return;
	event?.preventDefault();
	void (async () => {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		await openUrl(url);
	})();
};
