import { describe, expect, it } from "vitest";
import {
	chromeModeFor,
	composeWindowTitle,
	controlsLayoutFrom,
	toPhysicalRect,
} from "./window-chrome";

const MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/130.0";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; A065) AppleWebKit/537.36";

describe("window chrome", () => {
	it("draws its own bar only inside the desktop native shell", () => {
		expect(chromeModeFor(MAC, true)).toBe("macos");
		expect(chromeModeFor(WINDOWS, true)).toBe("windows");
		expect(chromeModeFor(LINUX, true)).toBe("linux");
		expect(chromeModeFor(ANDROID, true)).toBe("none");
		expect(chromeModeFor(MAC, false)).toBe("none");
	});

	it("titles the window with the channel and Space", () => {
		expect(composeWindowTitle("Colibri HQ", "general")).toBe(
			"general · Colibri HQ",
		);
		expect(composeWindowTitle("Colibri HQ", undefined)).toBe("Colibri HQ");
		expect(composeWindowTitle(undefined, "general")).toBe("Colibri");
	});

	it("follows the side of the desktop button layout and shows every control", () => {
		expect(controlsLayoutFrom(null)).toEqual({
			side: "right",
			order: ["minimize", "maximize", "close"],
		});
		expect(
			controlsLayoutFrom({ left: ["close", "minimize"], right: [] }),
		).toEqual({ side: "left", order: ["close", "minimize", "maximize"] });
		expect(
			controlsLayoutFrom({ left: ["appmenu"], right: ["spacer", "close"] }),
		).toEqual({ side: "right", order: ["minimize", "maximize", "close"] });
		expect(
			controlsLayoutFrom({ left: [], right: ["maximize", "close", "close"] }),
		).toEqual({ side: "right", order: ["minimize", "maximize", "close"] });
		expect(controlsLayoutFrom({ left: [], right: [] })).toEqual({
			side: "right",
			order: ["minimize", "maximize", "close"],
		});
	});

	it("covers every device pixel of the snap target", () => {
		expect(
			toPhysicalRect({ left: 10.4, top: 0, right: 56.2, bottom: 32 }, 1.5),
		).toEqual({ x: 15, y: 0, width: 70, height: 48 });
	});
});
