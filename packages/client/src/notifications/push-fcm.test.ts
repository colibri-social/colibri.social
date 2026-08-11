import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const registerDevice = vi.fn();
const getToken = vi.fn();

vi.mock("tauri-plugin-fcm", () => ({
	checkPermissions: () => checkPermissions(),
	requestPermissions: () => requestPermissions(),
	register: () => registerDevice(),
	getToken: () => getToken(),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "android" }));

const { subscribeFcmPush } = await import("./push-fcm");

beforeEach(() => {
	vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
	checkPermissions.mockResolvedValue("granted");
	requestPermissions.mockResolvedValue("granted");
	registerDevice.mockResolvedValue(undefined);
	getToken.mockResolvedValue({ token: "fresh-token" });
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("subscribeFcmPush", () => {
	it("registers the device token with the AppView", async () => {
		const register = vi.fn().mockResolvedValue(undefined);

		await expect(subscribeFcmPush(register)).resolves.toBe(true);
		expect(register).toHaveBeenCalledWith({
			platform: "android",
			token: "fresh-token",
		});
	});

	it("reports no subscription when Google Play Services is unavailable", async () => {
		getToken.mockRejectedValue(
			"java.util.concurrent.ExecutionException: java.io.IOException: SERVICE_NOT_AVAILABLE",
		);
		const register = vi.fn().mockResolvedValue(undefined);

		await expect(subscribeFcmPush(register)).resolves.toBe(false);
		expect(register).not.toHaveBeenCalled();
	});

	it("reports no subscription when the device cannot be registered", async () => {
		registerDevice.mockRejectedValue(new Error("registration failed"));
		const register = vi.fn().mockResolvedValue(undefined);

		await expect(subscribeFcmPush(register)).resolves.toBe(false);
		expect(getToken).not.toHaveBeenCalled();
		expect(register).not.toHaveBeenCalled();
	});

	it("reports no subscription when notifications were refused", async () => {
		checkPermissions.mockResolvedValue("denied");
		requestPermissions.mockResolvedValue("denied");
		const register = vi.fn().mockResolvedValue(undefined);

		await expect(subscribeFcmPush(register)).resolves.toBe(false);
		expect(registerDevice).not.toHaveBeenCalled();
		expect(register).not.toHaveBeenCalled();
	});

	it("still surfaces a failure from the AppView call itself", async () => {
		const register = vi.fn().mockRejectedValue(new Error("appview down"));

		await expect(subscribeFcmPush(register)).rejects.toThrow("appview down");
	});
});
