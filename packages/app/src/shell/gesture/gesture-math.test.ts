import { describe, expect, it } from "vitest";
import { decideAxis } from "./direction-lock";
import { projectDistance, projectedTarget } from "./projection";
import { bandedValue } from "./rubber-band";
import { isAtRest, paneSpring, stepSpring } from "./spring";
import { createVelocityTracker } from "./velocity";

describe("decideAxis", () => {
	it("waits until the finger moves past the slop", () => {
		expect(decideAxis(4, 5)).toBeNull();
	});

	it("locks horizontally within 30 degrees", () => {
		expect(decideAxis(20, 10)).toBe("horizontal");
		expect(decideAxis(-20, -11)).toBe("horizontal");
	});

	it("locks vertically past 30 degrees", () => {
		expect(decideAxis(20, 12)).toBe("vertical");
		expect(decideAxis(2, -30)).toBe("vertical");
	});
});

describe("projection", () => {
	it("projects nothing without velocity", () => {
		expect(projectDistance(0)).toBe(0);
	});

	it("commits a slow drag only past the halfway point", () => {
		expect(
			projectedTarget({ position: 0.4, velocity: 0, min: 0, max: 1 }),
		).toBe(0);
		expect(
			projectedTarget({ position: 0.6, velocity: 0, min: 0, max: 1 }),
		).toBe(1);
	});

	it("commits a short flick in the direction of travel", () => {
		expect(
			projectedTarget({ position: 0.9, velocity: -1.5, min: 0, max: 1 }),
		).toBe(0);
		expect(
			projectedTarget({ position: 0.1, velocity: 1.5, min: 0, max: 1 }),
		).toBe(1);
	});

	it("never targets outside the allowed range", () => {
		expect(projectedTarget({ position: 1, velocity: 20, min: 0, max: 1 })).toBe(
			1,
		);
	});
});

describe("spring", () => {
	it("settles on the target without overshooting from rest", () => {
		let state = { position: 0, velocity: 0 };
		let peak = 0;
		for (let frame = 0; frame < 120; frame++) {
			state = stepSpring(state, 1, paneSpring, 1 / 60);
			peak = Math.max(peak, state.position);
		}
		expect(isAtRest(state, 1)).toBe(true);
		expect(peak).toBeLessThanOrEqual(1.0005);
	});

	it("keeps the release velocity at the start", () => {
		const next = stepSpring(
			{ position: 0.5, velocity: -3 },
			0,
			paneSpring,
			1 / 120,
		);
		expect(next.position).toBeLessThan(0.5 - 3 / 120 + 0.01);
		expect(next.velocity).toBeLessThan(0);
	});
});

describe("rubber band", () => {
	it("passes values inside the range through", () => {
		expect(bandedValue(0.5, 0, 1, 1)).toBe(0.5);
	});

	it("resists past the bounds", () => {
		const banded = bandedValue(1.5, 0, 1, 1);
		expect(banded).toBeGreaterThan(1);
		expect(banded).toBeLessThan(1.5);
	});
});

describe("velocity tracker", () => {
	it("measures recent motion in units per second", () => {
		const tracker = createVelocityTracker();
		tracker.add(0, 0);
		tracker.add(10, 16);
		tracker.add(20, 32);
		expect(tracker.velocity(32)).toBeCloseTo(625, 0);
	});

	it("reports zero once the finger rests before lifting", () => {
		const tracker = createVelocityTracker();
		tracker.add(0, 0);
		tracker.add(30, 16);
		tracker.add(30, 200);
		expect(tracker.velocity(200)).toBe(0);
	});

	it("keeps the speed of a flick lifted mid-motion", () => {
		const tracker = createVelocityTracker();
		tracker.add(0, 0);
		tracker.add(40, 16);
		tracker.add(80, 32);
		tracker.add(100, 40);
		expect(tracker.velocity(40)).toBeCloseTo(2500, 0);
	});
});
