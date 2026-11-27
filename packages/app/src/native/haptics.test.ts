import { setLogLevel } from "@colibri-social/lib";
import { describe, expect, it, vi } from "vitest";
import {
	createAndroidHaptics,
	createNativeHaptics,
	gateHaptics,
	resolveHaptics,
	silentHaptics,
} from "./haptics";

const fakePlugin = () => ({
	impactFeedback: vi.fn(async () => ({ status: "ok", data: null })),
	notificationFeedback: vi.fn(async () => ({ status: "ok", data: null })),
	selectionFeedback: vi.fn(async () => ({ status: "ok", data: null })),
});

const fakeBridge = () => ({ perform: vi.fn(), enabled: vi.fn(() => true) });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createNativeHaptics", () => {
	it("maps each method to the plugin's feedback calls", async () => {
		const plugin = fakePlugin();
		const load = vi.fn(async () => plugin);
		const haptics = createNativeHaptics(load);
		haptics.impact("rigid");
		haptics.notification("warning");
		haptics.selection();
		await flush();
		expect(plugin.impactFeedback).toHaveBeenCalledWith("rigid");
		expect(plugin.notificationFeedback).toHaveBeenCalledWith("warning");
		expect(plugin.selectionFeedback).toHaveBeenCalledOnce();
		expect(load).toHaveBeenCalledOnce();
	});

	it("swallows plugin failures", async () => {
		const plugin = fakePlugin();
		plugin.impactFeedback.mockRejectedValue(new Error("no motor"));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		setLogLevel("warn");

		try {
			const haptics = createNativeHaptics(async () => plugin);
			haptics.impact("light");
			haptics.impact("light");
			await flush();
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			setLogLevel("error");
			warn.mockRestore();
		}
	});
});

describe("createAndroidHaptics", () => {
	it("sends each kind to the Android bridge", () => {
		const bridge = fakeBridge();
		const haptics = createAndroidHaptics(bridge);
		haptics.impact("medium");
		haptics.selection();
		haptics.notification("error");
		expect(bridge.perform.mock.calls).toEqual([
			["impact:medium"],
			["selection"],
			["notification:error"],
		]);
	});

	it("does nothing without a bridge", () => {
		expect(() => createAndroidHaptics(undefined).selection()).not.toThrow();
	});
});

describe("gateHaptics", () => {
	it("drops every call while haptics are not allowed", () => {
		const bridge = fakeBridge();
		let allowed = false;
		const haptics = gateHaptics(createAndroidHaptics(bridge), () => allowed);
		haptics.impact("light");
		haptics.selection();
		haptics.notification("success");
		expect(bridge.perform).not.toHaveBeenCalled();
		allowed = true;
		haptics.selection();
		expect(bridge.perform).toHaveBeenCalledWith("selection");
	});
});

describe("resolveHaptics", () => {
	it("is silent outside the mobile apps", () => {
		expect(resolveHaptics("web", () => true)).toBe(silentHaptics);
		expect(resolveHaptics("macos", () => true)).toBe(silentHaptics);
	});

	it("gates the mobile apps", () => {
		expect(resolveHaptics("ios", () => true)).not.toBe(silentHaptics);
		expect(resolveHaptics("android", () => true)).not.toBe(silentHaptics);
	});
});
