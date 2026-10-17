import { classifyThrown, createLogger } from "@colibri-social/lib";
import { toast, type UpdateState } from "@colibri-social/ui";
import { createSignal } from "solid-js";

export type InstallChannel = "direct" | "homebrew" | "scoop";

export type UpdateCheckResult =
	| { status: "unsupported" }
	| { status: "error"; error: unknown }
	| { status: "up-to-date" }
	| {
			status: "update-available";
			channel: InstallChannel;
			version: string;
			download: () => Promise<void>;
	  };

const log = createLogger("updater");

const CHECK_INTERVAL_MS = 5 * 60 * 60 * 1000;

const MISSING_PLUGIN_MS = 50;

const MISSING_PLUGIN = /plugin updater not found/i;

const HOMEBREW_CASKROOM_PATHS = [
	"/opt/homebrew/Caskroom/colibri-social",
	"/usr/local/Caskroom/colibri-social",
];

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const detectInstallChannel = async (): Promise<InstallChannel> => {
	try {
		if (navigator.userAgent.includes("Mac")) {
			const { exists } = await import("@tauri-apps/plugin-fs");
			for (const caskroom of HOMEBREW_CASKROOM_PATHS) {
				if (await exists(caskroom)) return "homebrew";
			}
		} else if (navigator.userAgent.includes("Windows")) {
			const { resourceDir } = await import("@tauri-apps/api/path");
			if (/[\\/]scoop[\\/]apps[\\/]/i.test(await resourceDir())) return "scoop";
		}
	} catch {}
	return "direct";
};

export const upgradeCommandFor = (channel: InstallChannel): string | null => {
	if (channel === "homebrew") return "brew upgrade --cask colibri-social";
	if (channel === "scoop") return "scoop update colibri-social";
	return null;
};

export const runUpdateCheck = async (): Promise<UpdateCheckResult> => {
	if (!isTauri()) return { status: "unsupported" };

	let startedAt = performance.now();
	try {
		const { check } = await import("@tauri-apps/plugin-updater");
		startedAt = performance.now();
		const update = await check();
		if (!update) return { status: "up-to-date" };
		return {
			status: "update-available",
			channel: await detectInstallChannel(),
			version: update.version,
			download: () => update.downloadAndInstall(),
		};
	} catch (error) {
		if (
			MISSING_PLUGIN.test(String(error)) ||
			performance.now() - startedAt < MISSING_PLUGIN_MS
		) {
			return { status: "unsupported" };
		}
		return { status: "error", error };
	}
};

export const restartToApply = async (): Promise<void> => {
	try {
		const { relaunch } = await import("@tauri-apps/plugin-process");
		await relaunch();
	} catch (error) {
		log.error("restart after update failed", {
			code: classifyThrown(error).code,
		});
		toast.error("Couldn't restart Colibri", {
			description: "Quit and open it again to finish the update.",
		});
	}
};

export const createUpdater = () => {
	const [state, setState] = createSignal<UpdateState>({ status: "idle" });
	const [supported, setSupported] = createSignal(false);
	let notifiedVersion: string | undefined;
	let running: Promise<void> | undefined;

	const notifyOnce = (version: string, show: () => void) => {
		if (notifiedVersion === version) return;
		notifiedVersion = version;
		show();
	};

	const performCheck = async (notify: boolean): Promise<void> => {
		if (state().status === "ready") return;

		const previous = state();
		setState({ status: "checking" });
		const result = await runUpdateCheck();

		if (result.status === "unsupported") {
			setSupported(false);
			setState(previous);
			return;
		}
		setSupported(true);

		if (result.status === "up-to-date") {
			setState({ status: "up-to-date" });
			return;
		}
		if (result.status === "error") {
			log.warn("update check failed", {
				code: classifyThrown(result.error).code,
			});
			setState({ status: "error" });
			return;
		}

		const command = upgradeCommandFor(result.channel);
		if (command) {
			setState({ status: "managed", version: result.version, command });
			if (notify) {
				notifyOnce(result.version, () =>
					toast(`Colibri ${result.version} is available`, {
						description: `Run ${command} to update.`,
						duration: 15000,
					}),
				);
			}
			return;
		}

		setState({ status: "downloading", version: result.version });
		try {
			await result.download();
		} catch (error) {
			log.error("update download failed", {
				code: classifyThrown(error).code,
			});
			setState({ status: "error" });
			return;
		}

		setState({ status: "ready", version: result.version });
		if (notify) {
			notifyOnce(result.version, () =>
				toast("Update ready", {
					description: `Colibri ${result.version} is downloaded. Restart to finish updating.`,
					duration: Number.POSITIVE_INFINITY,
					action: { label: "Restart", onClick: () => void restartToApply() },
				}),
			);
		}
	};

	const check = (options: { notify?: boolean } = {}) => {
		running ??= performCheck(options.notify ?? false).finally(() => {
			running = undefined;
		});
		return running;
	};

	return { state, supported, check };
};

const updater = createUpdater();

export const updateState = updater.state;
export const updaterSupported = updater.supported;
export const checkForUpdates = updater.check;

export const installUpdater = (): void => {
	if (!isTauri()) return;
	void checkForUpdates({ notify: true });
	setInterval(() => void checkForUpdates({ notify: true }), CHECK_INTERVAL_MS);
};
