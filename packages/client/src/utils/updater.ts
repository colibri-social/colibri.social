import { getVersion } from "@tauri-apps/api/app";
import { isTauriRuntime } from "../notifications/environment";

export type InstallChannel = "direct" | "homebrew" | "scoop";

export type UpdateCheckResult =
	| { status: "unsupported" }
	| { status: "error"; message: string }
	| { status: "up-to-date" }
	| {
			status: "update-available";
			channel: InstallChannel;
			version: string;
			notes: string;
			download: () => Promise<void>;
	  };

const detectPackageManagerChannel =
	async (): Promise<InstallChannel | null> => {
		try {
			const { platform } = await import("@tauri-apps/plugin-os");
			const os = platform();

			if (os === "macos") {
				const { exists, BaseDirectory } = await import("@tauri-apps/plugin-fs");
				if (
					await exists(".install-channel", { baseDir: BaseDirectory.Resource })
				) {
					return "homebrew";
				}
			} else if (os === "windows") {
				const { resourceDir } = await import("@tauri-apps/api/path");
				const dir = await resourceDir();
				if (/[\\/]scoop[\\/]apps[\\/]/i.test(dir)) return "scoop";
			}
		} catch {}

		return null;
	};

export const runUpdateCheck = async (): Promise<UpdateCheckResult> => {
	if (!isTauriRuntime()) return { status: "unsupported" };

	const startedAt = performance.now();
	try {
		const { check } = await import("@tauri-apps/plugin-updater");
		const update = await check();
		if (!update) return { status: "up-to-date" };

		const channel = (await detectPackageManagerChannel()) ?? "direct";
		return {
			status: "update-available",
			channel,
			version: update.version,
			notes: update.body ?? "",
			download: () => update.downloadAndInstall(),
		};
	} catch (err) {
		if (performance.now() - startedAt < 50) return { status: "unsupported" };
		return {
			status: "error",
			message: err instanceof Error ? err.message : String(err),
		};
	}
};

export const getAppVersion = async (): Promise<string> => {
	if (!isTauriRuntime()) return "web";
	try {
		return await getVersion();
	} catch {
		return "unknown";
	}
};

export const upgradeCommandFor = (channel: InstallChannel): string | null => {
	if (channel === "homebrew") return "brew upgrade --cask colibri-social";
	if (channel === "scoop") return "scoop update colibri-social";
	return null;
};

export const restartToApply = async (): Promise<void> => {
	const { relaunch } = await import("@tauri-apps/plugin-process");
	await relaunch();
};
