const BEFORE_EXIT_EVENT = "colibri-before-exit";

export const QUIT_DRAIN_MS = 4_500;

type BeforeExit = () => Promise<unknown>;

let beforeExit: BeforeExit | undefined;

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const setBeforeExit = (work: BeforeExit): (() => void) => {
	beforeExit = work;
	return () => {
		if (beforeExit === work) beforeExit = undefined;
	};
};

export const runBeforeExit = async (deadlineMs = QUIT_DRAIN_MS) => {
	const work = beforeExit;
	if (!work) return;
	let timer: ReturnType<typeof setTimeout> | undefined;
	await Promise.race([
		work().catch(() => undefined),
		new Promise((resolve) => {
			timer = setTimeout(resolve, deadlineMs);
		}),
	]);
	clearTimeout(timer);
};

export const oauthRefreshSettled = async (did: string) => {
	if (typeof navigator === "undefined" || !navigator.locks?.request) return;
	await navigator.locks.request(
		`@atproto-oauth-client-${did}`,
		() => undefined,
	);
};

export const installQuitGuard = (): void => {
	if (!isTauri()) return;
	void Promise.all([
		import("@tauri-apps/api/core"),
		import("@tauri-apps/api/event"),
	])
		.then(([{ invoke }, { listen }]) =>
			listen(BEFORE_EXIT_EVENT, () => {
				void runBeforeExit().finally(() =>
					invoke("ready_to_exit").catch(() => undefined),
				);
			}),
		)
		.catch(() => undefined);
};
