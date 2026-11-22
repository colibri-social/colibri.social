import { describe, expect, it, vi } from "vitest";
import type { Layer } from "../shell/layers";
import {
	listenForSettingsShortcut,
	OPEN_SETTINGS_EVENT,
	openSettings,
} from "./settings-shortcut";

const fakeListen = () => {
	const handlers = new Map<string, () => void>();
	const stop = vi.fn();
	return {
		listen: async (event: string, handler: () => void) => {
			handlers.set(event, handler);
			return stop;
		},
		fire: (event: string) => handlers.get(event)?.(),
		stop,
	};
};

describe("settings shortcut", () => {
	it("opens settings when the menu item fires", async () => {
		const fake = fakeListen();
		const pushed: Layer[] = [];
		const stop = listenForSettingsShortcut(
			{ push: (layer) => pushed.push(layer) },
			fake.listen,
		);
		await Promise.resolve();
		fake.fire(OPEN_SETTINGS_EVENT);
		expect(pushed).toEqual([{ kind: "settings" }]);
		stop();
		expect(fake.stop).toHaveBeenCalledTimes(1);
	});

	it("leaves settings alone when they are already open", () => {
		const pushed: Layer[] = [];
		openSettings({
			push: (layer) => pushed.push(layer),
			top: () => ({ kind: "settings", page: "profile" }),
		});
		expect(pushed).toEqual([]);
	});

	it("stops a listener that registers after disposal", async () => {
		const fake = fakeListen();
		const stop = listenForSettingsShortcut({ push: () => {} }, fake.listen);
		stop();
		await Promise.resolve();
		await Promise.resolve();
		expect(fake.stop).toHaveBeenCalledTimes(1);
	});

	it("does nothing outside the native shell", () => {
		const stop = listenForSettingsShortcut({ push: () => {} });
		expect(stop).toBeTypeOf("function");
		stop();
	});
});
