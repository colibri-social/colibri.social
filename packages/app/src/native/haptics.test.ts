import { describe, expect, it, vi } from "vitest";
import { createNativeHaptics, resolveHaptics, webHaptics } from "./haptics";

const fakePlugin = () => ({
	impactFeedback: vi.fn(async () => ({ status: "ok", data: null })),
	notificationFeedback: vi.fn(async () => ({ status: "ok", data: null })),
	selectionFeedback: vi.fn(async () => ({ status: "ok", data: null })),
});

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
		const haptics = createNativeHaptics(async () => plugin);
		haptics.impact("light");
		haptics.impact("light");
		await flush();
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});
});

describe("resolveHaptics", () => {
	it("uses native haptics in the mobile apps", () => {
		const native = createNativeHaptics(async () => fakePlugin());
		expect(resolveHaptics("ios", () => native)).toBe(native);
		expect(resolveHaptics("android", () => native)).toBe(native);
	});

	it("keeps web haptics everywhere else", () => {
		const native = createNativeHaptics(async () => fakePlugin());
		expect(resolveHaptics("web", () => native)).toBe(webHaptics);
		expect(resolveHaptics("macos", () => native)).toBe(webHaptics);
	});
});
