import { appActive, setAppActive } from "@colibri-social/ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installAppActivity, installMobileActivity } from "./app-active";

const fakeWindow = (focused: boolean) => {
	let handler: ((event: { payload: boolean }) => void) | undefined;
	const unlisten = vi.fn();
	return {
		unlisten,
		emit: (payload: boolean) => handler?.({ payload }),
		window: () =>
			Promise.resolve({
				isFocused: () => Promise.resolve(focused),
				onFocusChanged: (next: (event: { payload: boolean }) => void) => {
					handler = next;
					return Promise.resolve(unlisten);
				},
			}),
	};
};

describe("installAppActivity", () => {
	let uninstall: (() => void) | undefined;

	beforeEach(() => {
		setAppActive(undefined);
	});

	afterEach(() => {
		uninstall?.();
		uninstall = undefined;
	});

	it("follows native window focus", async () => {
		const fake = fakeWindow(false);
		uninstall = installAppActivity({ enabled: true, window: fake.window });
		await vi.waitFor(() => expect(appActive()).toBe(false));
		fake.emit(true);
		expect(appActive()).toBe(true);
		fake.emit(false);
		expect(appActive()).toBe(false);
	});

	it("hands control back to DOM focus tracking on uninstall", async () => {
		const fake = fakeWindow(!appActive());
		const before = appActive();
		uninstall = installAppActivity({ enabled: true, window: fake.window });
		await vi.waitFor(() => expect(appActive()).toBe(!before));
		uninstall();
		uninstall = undefined;
		expect(fake.unlisten).toHaveBeenCalledTimes(1);
		expect(appActive()).toBe(before);
	});

	it("does nothing outside the desktop shell", async () => {
		const window = vi.fn();
		uninstall = installAppActivity({ enabled: false, window });
		expect(window).not.toHaveBeenCalled();
	});

	it("follows page visibility in the mobile shell", () => {
		const target = new EventTarget() as EventTarget & {
			visibilityState: DocumentVisibilityState;
		};
		target.visibilityState = "visible";
		uninstall = installMobileActivity(target);
		expect(appActive()).toBe(true);
		target.visibilityState = "hidden";
		target.dispatchEvent(new Event("visibilitychange"));
		expect(appActive()).toBe(false);
		target.visibilityState = "visible";
		target.dispatchEvent(new Event("visibilitychange"));
		expect(appActive()).toBe(true);
	});
});
