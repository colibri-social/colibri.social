import { describe, expect, it } from "vitest";
import { isSensorRegistered } from "./dnd-sensors";

describe("isSensorRegistered", () => {
	it("sees a sensor the provider still holds", () => {
		const sensors = { "pointer-sensor": { id: "pointer-sensor" } };
		expect(isSensorRegistered(sensors, "pointer-sensor")).toBe(true);
	});

	it("treats a sensor the provider cleared on unmount as gone", () => {
		const sensors = { "pointer-sensor": undefined };
		expect(isSensorRegistered(sensors, "pointer-sensor")).toBe(false);
	});

	it("treats a sensor that was never added as gone", () => {
		expect(isSensorRegistered({}, "pointer-sensor")).toBe(false);
	});

	it("keeps sensors of the same provider apart", () => {
		const sensors = { keyboard: {}, "pointer-sensor": undefined };
		expect(isSensorRegistered(sensors, "keyboard")).toBe(true);
		expect(isSensorRegistered(sensors, "pointer-sensor")).toBe(false);
	});

	it("works for numeric sensor ids", () => {
		expect(isSensorRegistered({ 3: {} }, 3)).toBe(true);
		expect(isSensorRegistered({ 3: {} }, 4)).toBe(false);
	});
});
