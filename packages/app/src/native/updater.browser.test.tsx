import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createUpdater,
	detectInstallChannel,
	restartToApply,
	runUpdateCheck,
} from "./updater";

const plugins = vi.hoisted(() => ({
	check: vi.fn(),
	exists: vi.fn(),
	resourceDir: vi.fn(),
	invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({ check: plugins.check }));
vi.mock("@tauri-apps/plugin-fs", () => ({ exists: plugins.exists }));
vi.mock("@tauri-apps/api/path", () => ({
	resourceDir: plugins.resourceDir,
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: plugins.invoke }));

const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };

const agent = (value: string) =>
	vi.spyOn(navigator, "userAgent", "get").mockReturnValue(value);

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

const slowly =
	<T,>(value: () => T) =>
	() =>
		new Promise<T>((resolve, reject) =>
			setTimeout(() => {
				try {
					resolve(value());
				} catch (error) {
					reject(error);
				}
			}, 80),
		);

beforeEach(() => {
	tauriWindow.__TAURI_INTERNALS__ = {};
	plugins.exists.mockResolvedValue(false);
	plugins.resourceDir.mockResolvedValue("C:\\Program Files\\Colibri");
	plugins.invoke.mockResolvedValue(false);
});

afterEach(() => {
	delete tauriWindow.__TAURI_INTERNALS__;
	vi.restoreAllMocks();
	for (const mock of Object.values(plugins)) mock.mockReset();
});

describe("runUpdateCheck", () => {
	it("is unsupported on the web", async () => {
		delete tauriWindow.__TAURI_INTERNALS__;
		expect(await runUpdateCheck()).toEqual({ status: "unsupported" });
		expect(plugins.check).not.toHaveBeenCalled();
	});

	it("is unsupported when the updater plugin is missing", async () => {
		plugins.check.mockRejectedValue(new Error("plugin updater not found"));
		expect(await runUpdateCheck()).toEqual({ status: "unsupported" });
	});

	it("reports a slow failure as an error", async () => {
		plugins.check.mockImplementation(
			slowly(() => {
				throw new Error("network down");
			}),
		);
		expect((await runUpdateCheck()).status).toBe("error");
	});
});

describe("detectInstallChannel", () => {
	it("finds Homebrew installs on macOS", async () => {
		agent(MAC);
		plugins.exists.mockImplementation(
			async (path: string) => path === "/opt/homebrew/Caskroom/colibri-social",
		);
		expect(await detectInstallChannel()).toBe("homebrew");
	});

	it("finds Scoop installs on Windows", async () => {
		agent(WINDOWS);
		plugins.resourceDir.mockResolvedValue(
			"C:\\Users\\lou\\scoop\\apps\\colibri-social\\current",
		);
		expect(await detectInstallChannel()).toBe("scoop");
	});

	it("falls back to a direct install", async () => {
		agent(WINDOWS);
		expect(await detectInstallChannel()).toBe("direct");
		agent(MAC);
		expect(await detectInstallChannel()).toBe("direct");
	});
});

describe("checkForUpdates", () => {
	it("downloads once and stops checking after the update is ready", async () => {
		agent(WINDOWS);
		const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
		plugins.check.mockImplementation(
			slowly(() => ({ version: "0.18.3", downloadAndInstall })),
		);
		const updater = createUpdater();

		await Promise.all([updater.check({ notify: true }), updater.check()]);
		await updater.check();

		expect(plugins.check).toHaveBeenCalledOnce();
		expect(downloadAndInstall).toHaveBeenCalledOnce();
		expect(updater.supported()).toBe(true);
		expect(updater.state()).toEqual({
			status: "ready",
			version: "0.18.3",
		});
	});

	it("shows the package manager command and skips the download", async () => {
		agent(MAC);
		plugins.exists.mockResolvedValue(true);
		const downloadAndInstall = vi.fn();
		plugins.check.mockImplementation(
			slowly(() => ({ version: "0.18.3", downloadAndInstall })),
		);
		const updater = createUpdater();

		await updater.check();

		expect(downloadAndInstall).not.toHaveBeenCalled();
		expect(updater.state()).toEqual({
			status: "managed",
			version: "0.18.3",
			command: "brew upgrade --cask colibri-social",
		});
	});

	it("stays hidden when the build has no updater", async () => {
		plugins.check.mockRejectedValue(new Error("plugin updater not found"));
		const updater = createUpdater();

		await updater.check();

		expect(updater.supported()).toBe(false);
		expect(updater.state()).toEqual({ status: "idle" });
	});

	it("stages deb and rpm updates for the restart", async () => {
		const downloadAndInstall = vi.fn();
		plugins.invoke.mockImplementation(async (command: string) =>
			command === "update_installs_on_restart" ? true : undefined,
		);
		plugins.check.mockImplementation(
			slowly(() => ({ version: "0.18.3", rid: 7, downloadAndInstall })),
		);
		const updater = createUpdater();

		await updater.check();

		expect(downloadAndInstall).not.toHaveBeenCalled();
		expect(plugins.invoke).toHaveBeenCalledWith("update_stage", { rid: 7 });
		expect(updater.state()).toEqual({ status: "ready", version: "0.18.3" });
	});

	it("installs in the background when the install query fails", async () => {
		agent(WINDOWS);
		plugins.invoke.mockRejectedValue(new Error("command not found"));
		const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
		plugins.check.mockImplementation(
			slowly(() => ({ version: "0.18.3", downloadAndInstall })),
		);
		const updater = createUpdater();

		await updater.check();

		expect(downloadAndInstall).toHaveBeenCalledOnce();
		expect(updater.state()).toEqual({ status: "ready", version: "0.18.3" });
	});

	it("reports a failed download", async () => {
		agent(WINDOWS);
		const downloadAndInstall = vi.fn().mockRejectedValue(new Error("disk"));
		plugins.check.mockImplementation(
			slowly(() => ({ version: "0.18.3", downloadAndInstall })),
		);
		const updater = createUpdater();

		await updater.check();

		expect(updater.state()).toEqual({ status: "error" });
	});
});

describe("restartToApply", () => {
	it("restarts through the native shell", async () => {
		plugins.invoke.mockResolvedValue(undefined);

		await restartToApply();

		expect(plugins.invoke).toHaveBeenCalledWith("restart_app", undefined);
	});
});
