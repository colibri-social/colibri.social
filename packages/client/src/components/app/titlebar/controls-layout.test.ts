import { describe, expect, it } from "vitest";
import { parseGnomeButtonLayout } from "./controls-layout";

describe("parseGnomeButtonLayout", () => {
	it("reads the GNOME default as all three on the right", () => {
		expect(parseGnomeButtonLayout("'appmenu:minimize,maximize,close'")).toEqual(
			{
				side: "right",
				order: ["minimize", "maximize", "close"],
			},
		);
	});

	it("reads upstream GNOME as close alone on the right", () => {
		expect(parseGnomeButtonLayout("appmenu:close")).toEqual({
			side: "right",
			order: ["close"],
		});
	});

	it("reads a left-hand layout", () => {
		expect(parseGnomeButtonLayout("close,minimize,maximize:")).toEqual({
			side: "left",
			order: ["close", "minimize", "maximize"],
		});
	});

	it("drops tokens it does not render", () => {
		expect(parseGnomeButtonLayout("icon,menu:spacer,minimize,close")).toEqual({
			side: "right",
			order: ["minimize", "close"],
		});
	});

	it("falls back to the default on an empty value", () => {
		expect(parseGnomeButtonLayout("")).toEqual({
			side: "right",
			order: ["minimize", "maximize", "close"],
		});
	});

	it("yields no buttons rather than throwing on garbage", () => {
		expect(parseGnomeButtonLayout("not a layout at all")).toEqual({
			side: "right",
			order: [],
		});
	});
});
