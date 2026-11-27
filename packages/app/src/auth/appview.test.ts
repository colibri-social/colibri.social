import { DEFAULT_APPVIEW_URL } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_KEYS } from "../data/device-prefs";
import { appViewUrl, builtInAppViewUrl, chooseAppView } from "./appview";

const items = new Map<string, string>();

beforeEach(() => {
	items.clear();
	vi.stubEnv("VITE_COLIBRI_APPVIEW_URL", "");
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => items.set(key, value),
		removeItem: (key: string) => items.delete(key),
	});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("appViewUrl", () => {
	it("prefers the server the user chose over the built-in one", () => {
		chooseAppView("https://chat.example.com");

		expect(appViewUrl()).toBe("https://chat.example.com");
		expect(builtInAppViewUrl()).toBe(DEFAULT_APPVIEW_URL);
	});

	it("ignores a stored value that isn't a server address", () => {
		items.set(DEVICE_KEYS.appView, "not a server");

		expect(appViewUrl()).toBe(DEFAULT_APPVIEW_URL);
	});

	it("forgets the choice when the user goes back to the built-in server", () => {
		chooseAppView("https://chat.example.com");
		chooseAppView(DEFAULT_APPVIEW_URL);

		expect(items.has(DEVICE_KEYS.appView)).toBe(false);
		expect(appViewUrl()).toBe(DEFAULT_APPVIEW_URL);
	});
});
