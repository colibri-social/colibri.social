import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isPermissionRevoked, watchNotificationPermission } = await import(
	"./permission-sync"
);

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("isPermissionRevoked", () => {
	it("revokes an enabled preference the user denied", () => {
		expect(isPermissionRevoked(true, "denied")).toBe(true);
	});

	it("leaves a granted permission alone", () => {
		expect(isPermissionRevoked(true, "granted")).toBe(false);
	});

	it("leaves an undecided prompt alone", () => {
		expect(isPermissionRevoked(true, "default")).toBe(false);
	});

	it("never treats an unreadable permission as a denial", () => {
		expect(isPermissionRevoked(true, "unknown")).toBe(false);
	});

	it("does nothing when the preference is already off", () => {
		expect(isPermissionRevoked(false, "denied")).toBe(false);
	});
});

describe("watchNotificationPermission", () => {
	const addEventListener = vi.fn();
	const removeEventListener = vi.fn();
	const query = vi.fn();

	beforeEach(() => {
		query.mockResolvedValue({ addEventListener, removeEventListener });
		vi.stubGlobal("window", { Notification: {} });
		vi.stubGlobal("navigator", { permissions: { query } });
	});

	it("reports browser permission changes", async () => {
		const onChange = vi.fn();
		watchNotificationPermission(onChange);
		await vi.waitFor(() => expect(addEventListener).toHaveBeenCalled());

		expect(query).toHaveBeenCalledWith({ name: "notifications" });
		addEventListener.mock.calls[0][1]();
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("stops reporting once cancelled", async () => {
		const cancel = watchNotificationPermission(vi.fn());
		await vi.waitFor(() => expect(addEventListener).toHaveBeenCalled());

		cancel();
		expect(removeEventListener).toHaveBeenCalledWith(
			"change",
			addEventListener.mock.calls[0][1],
		);
	});

	it("does nothing without the Permissions API", () => {
		vi.stubGlobal("navigator", {});

		expect(watchNotificationPermission(vi.fn())).toBeInstanceOf(Function);
		expect(query).not.toHaveBeenCalled();
	});

	it("does nothing inside a native webview", () => {
		vi.stubGlobal("window", { __TAURI_INTERNALS__: {}, Notification: {} });

		watchNotificationPermission(vi.fn());
		expect(query).not.toHaveBeenCalled();
	});
});
