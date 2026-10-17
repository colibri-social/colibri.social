import { createRoot } from "solid-js";
import { expect, it } from "vitest";
import { createDeviceNotifications } from "./device";
import type { OsNotifier, OsPermission } from "./types";

const notifier = (state: { permission: OsPermission; answer?: OsPermission }) =>
	({
		kind: "web",
		permission: async () => state.permission,
		requestPermission: async () => state.answer ?? state.permission,
	}) as OsNotifier;

const create = (state: { permission: OsPermission; answer?: OsPermission }) =>
	createRoot(() => createDeviceNotifications(async () => notifier(state)));

it("turns itself on once when permission is already granted", async () => {
	const device = create({ permission: "granted" });
	await device.refresh();
	expect(device.active()).toBe(true);
	await device.setEnabled(false);
	await device.refresh();
	expect(device.enabled()).toBe(false);
});

it("turns off when permission is revoked", async () => {
	const state = { permission: "granted" as OsPermission };
	const device = create(state);
	await device.refresh();
	state.permission = "denied";
	await device.refresh();
	expect(device.enabled()).toBe(false);
});

it("asks for permission when switched on and remembers the answer", async () => {
	localStorage.removeItem("colibri:notification-prompt-answered");
	const device = create({ permission: "default", answer: "granted" });
	await device.refresh();
	expect(device.enabled()).toBe(false);
	expect(device.answered()).toBe(false);
	await device.setEnabled(true);
	expect(device.active()).toBe(true);
	expect(device.answered()).toBe(true);
});

it("stays off when the request is denied", async () => {
	const device = create({ permission: "default", answer: "denied" });
	await device.refresh();
	await device.setEnabled(true);
	expect(device.enabled()).toBe(false);
	expect(device.permission()).toBe("denied");
});
