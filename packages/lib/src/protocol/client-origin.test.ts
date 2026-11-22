import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_ORIGIN, clientOrigin } from "./client-origin";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("clientOrigin", () => {
	it("uses the page origin on the web", () => {
		vi.stubGlobal("window", {});
		vi.stubGlobal("location", {
			protocol: "https:",
			origin: "https://next.colibri.social",
		});
		expect(clientOrigin()).toBe("https://next.colibri.social");
	});

	it("uses the client origin inside the native shell", () => {
		vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
		vi.stubGlobal("location", {
			protocol: "http:",
			origin: "http://tauri.localhost",
		});
		expect(clientOrigin()).toBe(CLIENT_ORIGIN);
	});

	it("uses the client origin for a non-web scheme", () => {
		vi.stubGlobal("window", {});
		vi.stubGlobal("location", {
			protocol: "tauri:",
			origin: "tauri://localhost",
		});
		expect(clientOrigin()).toBe(CLIENT_ORIGIN);
	});
});
