import { describe, expect, it } from "vitest";
import { autoscrollSpeed, rubberBand } from "./autoscroll";

const edges = { start: 0, end: 800 };

describe("autoscrollSpeed", () => {
	it("is still away from the edges", () => {
		expect(autoscrollSpeed(400, edges)).toBe(0);
		expect(autoscrollSpeed(72, edges)).toBe(0);
		expect(autoscrollSpeed(728, edges)).toBe(0);
	});

	it("speeds up the deeper the pointer sits in an edge zone", () => {
		const shallow = autoscrollSpeed(780 - 40, edges);
		const deep = autoscrollSpeed(790, edges);
		expect(shallow).toBeGreaterThan(0);
		expect(deep).toBeGreaterThan(shallow);
		expect(autoscrollSpeed(20, edges)).toBeLessThan(0);
	});

	it("caps the speed past the edge", () => {
		expect(autoscrollSpeed(2000, edges)).toBe(1400);
		expect(autoscrollSpeed(-500, edges, { maxSpeed: 900 })).toBe(-900);
	});

	it("shrinks the zone on short scrollers", () => {
		expect(autoscrollSpeed(50, { start: 0, end: 200 })).toBe(0);
		expect(autoscrollSpeed(10, { start: 0, end: 200 })).toBeLessThan(0);
	});
});

describe("rubberBand", () => {
	it("resists more the further it is pulled", () => {
		const near = rubberBand(20, 120);
		const far = rubberBand(200, 120);
		expect(near).toBeLessThan(20);
		expect(far).toBeLessThan(120);
		expect(far - near).toBeLessThan(180);
		expect(rubberBand(-40, 120)).toBeCloseTo(-rubberBand(40, 120));
		expect(rubberBand(0, 120)).toBe(0);
	});
});
