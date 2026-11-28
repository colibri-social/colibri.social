import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { hapticsSetting } from "../../../data/haptics-setting";
import AppearancePage from "./appearance";
import { cleanup, mountPage } from "./page-test-kit";

const system = vi.hoisted(() => ({
	available: false,
	setEnabled: undefined as unknown as (value: boolean) => void,
}));

vi.mock("../../../native/haptics-system", async (original) => {
	const [enabled, setEnabled] = createSignal(true);
	system.setEnabled = setEnabled;
	return {
		...(await original<typeof import("../../../native/haptics-system")>()),
		hapticsAvailable: () => system.available,
		systemHapticsEnabled: enabled,
	};
});

afterEach(() => {
	cleanup();
	system.available = false;
	system.setEnabled(true);
	hapticsSetting()[1](true);
});

it("hides haptics where nothing can vibrate", async () => {
	await mountPage(() => <AppearancePage platform="mobile" />);
	await expect.element(page.getByText("Show message previews")).toBeVisible();
	expect(document.body.textContent).not.toContain("Haptics");
});

it("turns haptics off for this device", async () => {
	system.available = true;
	await mountPage(() => <AppearancePage platform="mobile" />);
	const toggle = page.getByRole("switch", { name: /Haptics/ });
	await expect.element(toggle).toBeChecked();
	await userEvent.click(page.getByText("Haptics"));
	await expect.element(toggle).not.toBeChecked();
	expect(hapticsSetting()[0]()).toBe(false);
	expect(localStorage.getItem("colibri:haptics")).toBe("false");
});

it("disables the row while the device has touch feedback off", async () => {
	system.available = true;
	system.setEnabled(false);
	await mountPage(() => <AppearancePage platform="mobile" />);
	const toggle = page.getByRole("switch", { name: /Haptics/ });
	await expect.element(toggle).toBeDisabled();
	await expect.element(toggle).not.toBeChecked();
	await expect
		.element(page.getByText(/Touch feedback is off in your device settings/))
		.toBeVisible();
});
