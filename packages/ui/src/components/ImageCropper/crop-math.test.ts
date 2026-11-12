import { describe, expect, it } from "vitest";
import {
	bandView,
	clampView,
	fitFrame,
	MIN_ZOOM,
	minZoomFor,
	outputName,
	panLimits,
	sourceRect,
	targetRect,
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

	it("lets only the emoji shape zoom out to fit a wide image whole", () => {
		const wide = { width: 2000, height: 1000 };
		expect(minZoomFor("emoji", wide, frame)).toBe(0.5);
		expect(minZoomFor("emoji", frame, frame)).toBe(1);
		expect(minZoomFor("avatar", wide, frame)).toBe(MIN_ZOOM);
		expect(minZoomFor("banner", wide, frame)).toBe(MIN_ZOOM);
		expect(clampView({ zoom: 0.2, x: 0, y: 0 }, wide, frame).zoom).toBe(1);
		expect(clampView({ zoom: 0.2, x: 0, y: 0 }, wide, frame, 0.5).zoom).toBe(
			0.5,
		);
		expect(bandView({ zoom: 0.2, x: 0, y: 0 }, wide, frame, 0.5).zoom).toBe(
			0.5,
		);
		expect(
			zoomAround(
				{ zoom: 1, x: 0, y: 0 },
				0.1,
				{
					x: 0,
					y: 0,
				},
				0.5,
			).zoom,
		).toBe(0.5);
	});

	it("centres a contained image vertically with no pan slack", () => {
		const wide = { width: 2000, height: 1000 };
		const view = clampView({ zoom: 0.5, x: 40, y: 60 }, wide, frame, 0.5);
		expect(view).toEqual({ zoom: 0.5, x: 0, y: 0 });
		expect(sourceRect(view, wide, frame)).toEqual({
			x: 0,
			y: 0,
			width: 2000,
			height: 1000,
		});
	});

	it("letterboxes the contained image in the middle of the output", () => {
		const wide = { width: 2000, height: 1000 };
		const output = { width: 128, height: 128 };
		const contained = { zoom: 0.5, x: 0, y: 0 };
		expect(targetRect(contained, wide, frame, output)).toEqual({
			x: 0,
			y: 32,
			width: 128,
			height: 64,
		});
		const between = clampView({ zoom: 0.75, x: 30, y: 0 }, wide, frame, 0.5);
		const target = targetRect(between, wide, frame, output);
		expect(target.x).toBe(0);
		expect(target.width).toBe(128);
		expect(target.y).toBe(16);
		expect(target.height).toBe(96);
	});

	it("fills the whole output when the image covers the frame", () => {
		const output = { width: 512, height: 512 };
		expect(targetRect({ zoom: 1, x: 50, y: 0 }, image, frame, output)).toEqual({
			x: 0,
			y: 0,
			width: 512,
			height: 512,
		});
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
