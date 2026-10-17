const BEFORE_EXIT_EVENT = "colibri-before-exit";

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const installQuitGuard = (): void => {
	if (!isTauri()) return;
	void Promise.all([
		import("@tauri-apps/api/core"),
		import("@tauri-apps/api/event"),
	])
		.then(([{ invoke }, { listen }]) =>
			listen(BEFORE_EXIT_EVENT, () => {
				void invoke("ready_to_exit").catch(() => undefined);
			}),
		)
		.catch(() => undefined);
};
