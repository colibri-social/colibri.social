import { describe, expect, it, vi } from "vitest";
import {
	createAndroidRestart,
	resolveTouchKeyboardRestart,
} from "./touch-keyboard";

describe("createAndroidRestart", () => {
	it("calls the window bridge", () => {
		const restartInput = vi.fn();
		const restart = createAndroidRestart(() => ({ restartInput }));
		expect(restart()).toBe(true);
		expect(restartInput).toHaveBeenCalledOnce();
	});

	it("reports a missing bridge so the caller falls back", () => {
		expect(createAndroidRestart(() => undefined)()).toBe(false);
		expect(createAndroidRestart(() => ({}))()).toBe(false);
	});
});

describe("resolveTouchKeyboardRestart", () => {
	it("has no native restart on web and desktop", () => {
		expect(resolveTouchKeyboardRestart("web")).toBeUndefined();
		expect(resolveTouchKeyboardRestart("macos")).toBeUndefined();
		expect(resolveTouchKeyboardRestart("ios")).toBeUndefined();
	});
});
