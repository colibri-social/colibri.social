import { createSignal } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { AccountActionsContext } from "../../../auth/account-actions";
import { restartWithAppView } from "../../../auth/appview";
import { DEVICE_KEYS } from "../../../data/device-prefs";
import { checkServer } from "../../../data/server-check";
import { systemWindowControls } from "../../../data/system-window-controls";
import { type SettingsNav, SettingsNavContext } from "../nav";
import AdvancedPage from "./advanced";
import { cleanup, mountPage } from "./page-test-kit";

const updater = vi.hoisted(() => ({
	supported: undefined as unknown as () => boolean,
	setSupported: undefined as unknown as (value: boolean) => void,
	checkForUpdates: vi.fn(),
	restartToApply: vi.fn(),
}));

vi.mock("../../../native/updater", () => {
	const [supported, setSupported] = createSignal(false);
	updater.supported = supported;
	updater.setSupported = setSupported;
	return {
		updaterSupported: supported,
		updateState: () => ({ status: "ready", version: "0.18.3" }),
		checkForUpdates: updater.checkForUpdates,
		restartToApply: updater.restartToApply,
	};
});

vi.mock("../../../data/server-check", () => ({
	checkServer: vi.fn(async (url: string) => ({
		status: "ok",
		url,
		host: new URL(url).host,
		features: { calls: true, otherServers: true },
	})),
}));

vi.mock("../../../auth/appview", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../auth/appview")>()),
	restartWithAppView: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({
	getVersion: async () => "0.18.2",
}));

afterEach(() => {
	cleanup();
	updater.setSupported(false);
	systemWindowControls()[1](false);
	delete (window as unknown as { __TAURI_INTERNALS__?: unknown })
		.__TAURI_INTERNALS__;
	vi.restoreAllMocks();
});

const mountAdvanced = (signOut?: () => Promise<void>) => {
	const nav: SettingsNav = { open: vi.fn(), back: vi.fn() };
	const mounted = mountPage(() => (
		<AccountActionsContext.Provider value={signOut ? { signOut } : undefined}>
			<SettingsNavContext.Provider value={nav}>
				<AdvancedPage platform="mobile" />
			</SettingsNavContext.Provider>
		</AccountActionsContext.Provider>
	));
	return { nav, mounted };
};

it("hides the server picker when the app can't sign out", async () => {
	const { mounted } = mountAdvanced();
	await mounted;
	await expect
		.element(page.getByRole("button", { name: "Change server" }))
		.not.toBeInTheDocument();
});

it("checks a new server, signs out, then restarts on it", async () => {
	const order: string[] = [];
	const signOut = vi.fn(async () => {
		order.push("signOut");
	});
	vi.mocked(restartWithAppView).mockImplementation(() => {
		order.push("restart");
	});
	const { mounted } = mountAdvanced(signOut);
	await mounted;
	await userEvent.click(page.getByRole("button", { name: "Change server" }));
	await userEvent.fill(
		page.getByRole("textbox", { name: "Server address" }),
		"chat.example.com",
	);
	await userEvent.click(page.getByRole("button", { name: "Check server" }));
	await expect
		.element(page.getByRole("dialog", { name: "Switch to chat.example.com?" }))
		.toBeVisible();
	expect(checkServer).toHaveBeenCalledWith("https://chat.example.com");
	await userEvent.click(
		page.getByRole("button", { name: "Switch and sign out" }),
	);
	await expect.poll(() => order).toEqual(["signOut", "restart"]);
	expect(restartWithAppView).toHaveBeenCalledWith("https://chat.example.com");
});

it("syncs developer mode and hides options nothing can act on yet", async () => {
	const { mounted } = mountAdvanced();
	const { store } = await mounted;
	const developer = page.getByRole("switch", { name: /Developer mode/ });
	await expect.element(developer).not.toBeChecked();
	await userEvent.click(page.getByText("Developer mode"));
	await expect.poll(() => store.preferences.client().developerMode).toBe(true);
	await expect.element(developer).toBeChecked();

	await expect
		.element(page.getByText("Include my account in error reports"))
		.not.toBeInTheDocument();
	await expect
		.element(page.getByText("Use system window controls"))
		.not.toBeInTheDocument();
});

it("opens data deletion from the danger zone", async () => {
	const { nav, mounted } = mountAdvanced();
	await mounted;
	await expect.element(page.getByText("Danger zone")).toBeVisible();
	await userEvent.click(
		page.getByRole("button", { name: "Delete my Colibri data" }),
	);
	expect(nav.open).toHaveBeenCalledWith("deleteAccount");
});

it("hides updates where the build can't update itself", async () => {
	const { mounted } = mountAdvanced();
	await mounted;
	await expect.element(page.getByText("Developer mode")).toBeVisible();
	await expect
		.element(page.getByText("Updates", { exact: true }))
		.not.toBeInTheDocument();
});

it("shows the version and restarts into a downloaded update", async () => {
	updater.setSupported(true);
	const { mounted } = mountAdvanced();
	await mounted;
	await expect.element(page.getByText("Version 0.18.2")).toBeVisible();
	await expect.element(page.getByText("Beta", { exact: true })).toBeVisible();
	await expect
		.element(page.getByText("Version 0.18.3 is ready. Restart to finish."))
		.toBeVisible();
	await userEvent.click(
		page.getByRole("button", { name: "Restart to update" }),
	);
	expect(updater.restartToApply).toHaveBeenCalledOnce();
});

it("hands the window frame to the system on desktop", async () => {
	vi.spyOn(Navigator.prototype, "userAgent", "get").mockReturnValue(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0",
	);
	const invoke = vi.fn(async () => null);
	(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ =
		{ invoke };
	const { mounted } = mountAdvanced();
	await mounted;
	const toggle = page.getByRole("switch", {
		name: /Use system window controls/,
	});
	await expect.element(toggle).not.toBeChecked();
	await userEvent.click(page.getByText("Use system window controls"));
	await expect.element(toggle).toBeChecked();
	await expect
		.poll(() => invoke.mock.calls)
		.toContainEqual([
			"titlebar_set_native_decorations",
			{ enabled: true },
			undefined,
		]);
	expect(localStorage.getItem(DEVICE_KEYS.systemWindowControls)).toBe("true");
});
