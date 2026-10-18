import { describe, expect, it } from "vitest";
import {
	bandView,
	clampView,
	fitFrame,
	outputName,
	panLimits,
	sourceRect,
	workingSize,
	zoomAround,
} from "./crop-math";

const image = { width: 4000, height: 3000 };
const frame = { width: 300, height: 300 };

describe("crop math", () => {
	it("covers the frame at zoom 1 with no vertical slack", () => {
		const limits = panLimits(image, frame, 1);
		expect(limits.y).toBe(0);
		expect(limits.x).toBeCloseTo(50);
	});

	it("clamps panning so no empty edge shows", () => {
		const view = clampView({ zoom: 1, x: 500, y: -80 }, image, frame);
		expect(view).toEqual({ zoom: 1, x: 50, y: 0 });
	});

	it("rubber-bands past the limit but stays below the raw offset", () => {
		const banded = bandView({ zoom: 1, x: 200, y: 0 }, image, frame);
		expect(banded.x).toBeGreaterThan(50);
		expect(banded.x).toBeLessThan(200);
		expect(bandView({ zoom: 1, x: 20, y: 0 }, image, frame).x).toBe(20);
	});

	it("keeps the point under the fingers fixed while zooming", () => {
		const point = { x: 60, y: -40 };
		const next = zoomAround({ zoom: 1, x: 0, y: 0 }, 2, point);
		expect(next.zoom).toBe(2);
		expect(next.x).toBe(-60);
		expect(next.y).toBe(40);
		expect(zoomAround({ zoom: 1, x: 0, y: 0 }, 9, point).zoom).toBe(4);
		expect(zoomAround({ zoom: 2, x: 0, y: 0 }, 0.2, point).zoom).toBe(1);
	});

	it("maps the view to the centered source rectangle", () => {
		const rect = sourceRect({ zoom: 1, x: 0, y: 0 }, image, frame);
		expect(rect).toEqual({ x: 500, y: 0, width: 3000, height: 3000 });
		const zoomed = sourceRect({ zoom: 2, x: 0, y: 0 }, image, frame);
		expect(zoomed.width).toBe(1500);
		expect(zoomed.x).toBe(1250);
	});

	it("fits a banner frame inside the stage", () => {
		const banner = fitFrame({ width: 400, height: 600 }, 3, 16);
		expect(banner.width).toBe(368);
		expect(banner.height).toBeCloseTo(368 / 3);
	});

	it("caps the working size of large photos", () => {
		expect(workingSize({ width: 8000, height: 6000 })).toEqual({
			width: 4096,
			height: 3072,
		});
		expect(workingSize({ width: 800, height: 600 })).toEqual({
			width: 800,
			height: 600,
		});
	});

	it("names the output after the input", () => {
		expect(outputName("holiday.photo.png", "image/webp")).toBe(
			"holiday.photo.webp",
		);
		expect(outputName("scan", "image/jpeg")).toBe("scan.jpg");
		expect(outputName("wave.gif", "image/png")).toBe("wave.png");
	});
});
