import { afterEach, describe, expect, it, vi } from "vitest";
import { sellsThroughAppStore } from "./app-store";

const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };

afterEach(() => {
	delete tauriWindow.__TAURI_INTERNALS__;
	vi.restoreAllMocks();
});

const agent = (value: string) =>
	vi.spyOn(navigator, "userAgent", "get").mockReturnValue(value);

describe("sellsThroughAppStore", () => {
	it("is false on the web", () => {
		agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
		expect(sellsThroughAppStore()).toBe(false);
	});

	it("is true in the Mac, iOS and Android apps", () => {
		tauriWindow.__TAURI_INTERNALS__ = {};
		for (const value of [
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
			"Mozilla/5.0 (Linux; Android 15)",
		]) {
			agent(value);
			expect(sellsThroughAppStore()).toBe(true);
		}
	});

	it("is false in the Windows and Linux apps", () => {
		tauriWindow.__TAURI_INTERNALS__ = {};
		agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
		expect(sellsThroughAppStore()).toBe(false);
		agent("Mozilla/5.0 (X11; Linux x86_64)");
		expect(sellsThroughAppStore()).toBe(false);
	});
});
