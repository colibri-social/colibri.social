import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
let currentPlatform = "ios";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (command: string, args?: unknown) => invoke(command, args),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => currentPlatform }));

const { hasCachedApnsToken, subscribeApnsPush, unsubscribeApnsPush } =
	await import("./push-apns");

const storage = new Map<string, string>();

beforeEach(() => {
	currentPlatform = "ios";
	storage.clear();
	vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
	});
	invoke.mockResolvedValue({ token: "ab".repeat(32), environment: "sandbox" });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("subscribeApnsPush", () => {
	it("registers the device token and its environment", async () => {
		const register = vi.fn().mockResolvedValue(undefined);

		await expect(subscribeApnsPush(register)).resolves.toBe(true);
		expect(invoke).toHaveBeenCalledWith("apns_register", undefined);
		expect(register).toHaveBeenCalledWith({
			platform: "ios",
			token: "ab".repeat(32),
			environment: "sandbox",
		});
		expect(hasCachedApnsToken()).toBe(true);
	});

	it("reports the macOS platform on the Mac", async () => {
		currentPlatform = "macos";
		const register = vi.fn().mockResolvedValue(undefined);

		await subscribeApnsPush(register);
		expect(register).toHaveBeenCalledWith(
			expect.objectContaining({ platform: "macos" }),
		);
	});

	it("falls back when the build has no push entitlement", async () => {
		invoke.mockRejectedValue({
			code: "Unsupported",
			message: "no valid aps-environment entitlement string found",
		});
		const register = vi.fn().mockResolvedValue(undefined);

		await expect(subscribeApnsPush(register)).resolves.toBe(false);
		expect(register).not.toHaveBeenCalled();
	});

	it("unregisters the previous token when the device token changes", async () => {
		storage.set("colibri:apns:last-token", "old-token");
		const register = vi.fn().mockResolvedValue(undefined);
		const unregister = vi.fn().mockResolvedValue(undefined);

		await subscribeApnsPush(register, unregister);
		expect(unregister).toHaveBeenCalledWith("old-token");
	});

	it("does nothing outside iOS and macOS", async () => {
		currentPlatform = "android";
		const register = vi.fn();

		await expect(subscribeApnsPush(register)).resolves.toBe(false);
		expect(invoke).not.toHaveBeenCalled();
	});
});

describe("unsubscribeApnsPush", () => {
	it("unregisters the cached token and forgets it", async () => {
		storage.set("colibri:apns:last-token", "cached-token");
		const unregister = vi.fn().mockResolvedValue(undefined);

		await unsubscribeApnsPush(unregister);
		expect(unregister).toHaveBeenCalledWith("cached-token");
		expect(hasCachedApnsToken()).toBe(false);
	});
});
