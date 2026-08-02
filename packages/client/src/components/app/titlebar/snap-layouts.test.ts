import { describe, expect, it } from "vitest";
import { toPhysicalRect } from "./snap-layouts";

const rect = (left: number, top: number, width: number, height: number) => ({
	left,
	top,
	right: left + width,
	bottom: top + height,
});

describe("toPhysicalRect", () => {
	it("passes rects through unchanged at 1x", () => {
		expect(toPhysicalRect(rect(1000, 0, 46, 32), 1)).toEqual({
			x: 1000,
			y: 0,
			width: 46,
			height: 32,
		});
	});

	it("scales exactly at 2x", () => {
		expect(toPhysicalRect(rect(1000, 0, 46, 32), 2)).toEqual({
			x: 2000,
			y: 0,
			width: 92,
			height: 64,
		});
	});

	it("rounds outward at 1.5x so the rect never falls short", () => {
		const scaled = toPhysicalRect(rect(1000.5, 0, 46, 32), 1.5);
		expect(scaled.x).toBe(1500);
		expect(scaled.x + scaled.width).toBeGreaterThanOrEqual(
			Math.ceil(1046.5 * 1.5),
		);
	});

	it("never loses a pixel of the painted button at 1.25x", () => {
		for (let left = 1000; left < 1010; left += 1) {
			const scaled = toPhysicalRect(rect(left + 0.4, 0.6, 46, 32), 1.25);
			expect(scaled.x).toBeLessThanOrEqual((left + 0.4) * 1.25);
			expect(scaled.x + scaled.width).toBeGreaterThanOrEqual(
				(left + 46.4) * 1.25,
			);
			expect(scaled.y).toBeLessThanOrEqual(0.6 * 1.25);
			expect(scaled.y + scaled.height).toBeGreaterThanOrEqual(32.6 * 1.25);
		}
	});
});
