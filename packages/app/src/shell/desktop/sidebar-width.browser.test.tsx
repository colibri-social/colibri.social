import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	SIDEBAR_WIDTH_KEY,
	storedSidebarWidth,
	storedThreadWidth,
	storeSidebarWidth,
	storeThreadWidth,
	THREAD_WIDTH_KEY,
} from "./sidebar-width";

const createStorage = () => {
	const entries = new Map<string, string>();
	return {
		getItem: (key: string) => entries.get(key) ?? null,
		setItem: (key: string, value: string) => entries.set(key, value),
		removeItem: (key: string) => entries.delete(key),
		clear: () => entries.clear(),
	};
};

describe("channel list width storage", () => {
	beforeEach(() => vi.stubGlobal("localStorage", createStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("falls back to the default width", () => {
		expect(storedSidebarWidth()).toBe(288);
	});

	it("round-trips a stored width", () => {
		storeSidebarWidth(312);
		expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("312");
		expect(storedSidebarWidth()).toBe(312);
	});

	it("clamps stored widths to the allowed range", () => {
		storeSidebarWidth(1000);
		expect(storedSidebarWidth()).toBe(360);
		localStorage.setItem(SIDEBAR_WIDTH_KEY, "12");
		expect(storedSidebarWidth()).toBe(200);
	});

	it("ignores garbage and reads the previous client's preference", () => {
		localStorage.setItem(SIDEBAR_WIDTH_KEY, "wide");
		localStorage.setItem(
			"colibri:user-preferences",
			JSON.stringify({ channelSidebarWidth: 240 }),
		);
		expect(storedSidebarWidth()).toBe(240);
		localStorage.setItem("colibri:user-preferences", "{");
		expect(storedSidebarWidth()).toBe(288);
	});

	it("survives storage that throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("denied");
			},
			setItem: () => {
				throw new Error("denied");
			},
		});
		expect(() => storeSidebarWidth(300)).not.toThrow();
		expect(storedSidebarWidth()).toBe(288);
	});
});

describe("thread pane width storage", () => {
	beforeEach(() => vi.stubGlobal("localStorage", createStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("has no stored width until the pane is resized", () => {
		expect(storedThreadWidth()).toBeUndefined();
	});

	it("round-trips and clamps the width", () => {
		storeThreadWidth(500);
		expect(localStorage.getItem(THREAD_WIDTH_KEY)).toBe("500");
		expect(storedThreadWidth()).toBe(500);
		storeThreadWidth(5000);
		expect(storedThreadWidth()).toBe(720);
		localStorage.setItem(THREAD_WIDTH_KEY, "garbage");
		expect(storedThreadWidth()).toBeUndefined();
	});
});
