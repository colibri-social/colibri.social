import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isPermissionGranted = vi.fn();
const requestPermission = vi.fn();
const sendNotification = vi.fn();

const isNativeNotificationSupported = vi.fn();

vi.mock("@tauri-apps/plugin-notification", () => ({
	isPermissionGranted: () => isPermissionGranted(),
	requestPermission: () => requestPermission(),
	sendNotification: (payload: unknown) => sendNotification(payload),
	removeActive: () => Promise.resolve(),
}));

vi.mock("./tauri-native", () => ({
	isNativeNotificationSupported: () => isNativeNotificationSupported(),
	showNativeNotification: vi.fn(),
	dismissNativeChannel: vi.fn(),
	cacheNativeAvatar: vi.fn(),
}));

const { tauriBackend } = await import("./tauri");

const ACL_REFUSAL =
	"Command plugin:notification|is_permission_granted not allowed by ACL";

beforeEach(() => {
	vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
	isPermissionGranted.mockResolvedValue(true);
	requestPermission.mockResolvedValue("granted");
	isNativeNotificationSupported.mockResolvedValue(false);
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

	it("reports an unreadable permission as unknown rather than a denial", async () => {
		isPermissionGranted.mockRejectedValue(ACL_REFUSAL);

		await expect(tauriBackend.getPermission()).resolves.toBe("unknown");
	});

	it("reports denied outside a native webview", async () => {
		vi.stubGlobal("window", {});

		await expect(tauriBackend.getPermission()).resolves.toBe("denied");
		expect(isPermissionGranted).not.toHaveBeenCalled();
	});

	it("ignores the webview notification permission when native toasts work", async () => {
		isPermissionGranted.mockResolvedValue(false);
		isNativeNotificationSupported.mockResolvedValue(true);

		await expect(tauriBackend.getPermission()).resolves.toBe("granted");
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

	it("reports an unreadable permission as unknown rather than a denial", async () => {
		isPermissionGranted.mockRejectedValue(ACL_REFUSAL);

		await expect(tauriBackend.requestPermission()).resolves.toBe("unknown");
	});

	it("skips the webview prompt entirely when native toasts work", async () => {
		isNativeNotificationSupported.mockResolvedValue(true);

		await expect(tauriBackend.requestPermission()).resolves.toBe("granted");
		expect(isPermissionGranted).not.toHaveBeenCalled();
		expect(requestPermission).not.toHaveBeenCalled();
	});
});
