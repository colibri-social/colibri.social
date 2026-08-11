import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isPermissionGranted = vi.fn();
const requestPermission = vi.fn();
const sendNotification = vi.fn();

vi.mock("@tauri-apps/plugin-notification", () => ({
	isPermissionGranted: () => isPermissionGranted(),
	requestPermission: () => requestPermission(),
	sendNotification: (payload: unknown) => sendNotification(payload),
	removeActive: () => Promise.resolve(),
}));

const { tauriBackend } = await import("./tauri");

const ACL_REFUSAL =
	"Command plugin:notification|is_permission_granted not allowed by ACL";

beforeEach(() => {
	vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
	isPermissionGranted.mockResolvedValue(true);
	requestPermission.mockResolvedValue("granted");
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("tauriBackend.getPermission", () => {
	it("reports the permission the operating system granted", async () => {
		await expect(tauriBackend.getPermission()).resolves.toBe("granted");
	});

	it("reports an unanswered prompt as still undecided", async () => {
		isPermissionGranted.mockResolvedValue(false);

		await expect(tauriBackend.getPermission()).resolves.toBe("default");
	});

	it("settles instead of rejecting when the native command is refused", async () => {
		isPermissionGranted.mockRejectedValue(ACL_REFUSAL);

		await expect(tauriBackend.getPermission()).resolves.toBe("denied");
	});

	it("reports denied outside a native webview", async () => {
		vi.stubGlobal("window", {});

		await expect(tauriBackend.getPermission()).resolves.toBe("denied");
		expect(isPermissionGranted).not.toHaveBeenCalled();
	});
});

describe("tauriBackend.requestPermission", () => {
	it("skips the prompt when permission is already granted", async () => {
		await expect(tauriBackend.requestPermission()).resolves.toBe("granted");
		expect(requestPermission).not.toHaveBeenCalled();
	});

	it("prompts when no decision has been made yet", async () => {
		isPermissionGranted.mockResolvedValue(false);
		requestPermission.mockResolvedValue("denied");

		await expect(tauriBackend.requestPermission()).resolves.toBe("denied");
		expect(requestPermission).toHaveBeenCalledTimes(1);
	});

	it("settles instead of rejecting when the native command is refused", async () => {
		isPermissionGranted.mockRejectedValue(ACL_REFUSAL);

		await expect(tauriBackend.requestPermission()).resolves.toBe("denied");
	});
});
