import { describe, expect, it } from "vitest";
import {
	fitFrameSize,
	frameAt,
	frameDelayMs,
	frameTimeline,
} from "./frame-clock";

describe("frame clock", () => {
	it("reads frame durations in microseconds and pads instant frames", () => {
		expect(frameDelayMs(50_000)).toBe(50);
		expect(frameDelayMs(0)).toBe(100);
		expect(frameDelayMs(10_000)).toBe(100);
		expect(frameDelayMs(null)).toBe(100);
	});

	it("builds frame start offsets and the loop length", () => {
		expect(frameTimeline([100, 50, 200])).toEqual({
			starts: [0, 100, 150],
			loopMs: 350,
		});
	});

	it("picks the frame showing at a point in the loop", () => {
		const timeline = frameTimeline([100, 50, 200]);
		expect(frameAt(timeline, 0)).toBe(0);
		expect(frameAt(timeline, 99.9)).toBe(0);
		expect(frameAt(timeline, 100)).toBe(1);
		expect(frameAt(timeline, 149)).toBe(1);
		expect(frameAt(timeline, 150)).toBe(2);
		expect(frameAt(timeline, 349)).toBe(2);
	});

	it("wraps the clock so instances loaded at different times agree", () => {
		const timeline = frameTimeline([100, 50, 200]);
		expect(frameAt(timeline, 350)).toBe(0);
		expect(frameAt(timeline, 350 * 7 + 120)).toBe(1);
		expect(frameAt(timeline, 350 * 7 + 120)).toBe(frameAt(timeline, 120));
		expect(frameAt(timeline, -10)).toBe(2);
	});

	it("stays on the first frame for a single frame or an empty loop", () => {
		expect(frameAt(frameTimeline([80]), 500)).toBe(0);
		expect(frameAt(frameTimeline([]), 500)).toBe(0);
	});

	it("caps the decoded frame size at the longest side", () => {
		expect(fitFrameSize(1024, 512, 256)).toEqual({ width: 256, height: 128 });
		expect(fitFrameSize(64, 32, 256)).toEqual({ width: 64, height: 32 });
	});
});
