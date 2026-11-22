import { expect, it, vi } from "vitest";
import { createSystemHaptics } from "./haptics-system";

it("reads the Android setting and rereads it when the app returns", () => {
	const bridge = { perform: vi.fn(), enabled: vi.fn(() => false) };
	const enabled = createSystemHaptics(bridge);
	expect(enabled()).toBe(false);
	bridge.enabled.mockReturnValue(true);
	document.dispatchEvent(new Event("visibilitychange"));
	expect(enabled()).toBe(true);
});

it("treats a missing bridge as enabled", () => {
	expect(createSystemHaptics(undefined)()).toBe(true);
});
