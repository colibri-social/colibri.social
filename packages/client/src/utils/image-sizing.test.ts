import { describe, expect, it } from "vitest";
import { constrainedImageStyle, parseAspectRatio } from "./image-sizing";

describe("parseAspectRatio", () => {
	it("reads a two sided ratio", () => {
		expect(parseAspectRatio("16 / 9")).toBeCloseTo(1.778, 3);
	});

	it("reads a bare number, the shape a decoded ratio is stored in", () => {
		expect(parseAspectRatio("1.9047619047619047")).toBeCloseTo(1.905, 3);
	});

	it("rejects a zero or unparseable side", () => {
		expect(parseAspectRatio("16 / 0")).toBeUndefined();
		expect(parseAspectRatio("wide")).toBeUndefined();
		expect(parseAspectRatio(undefined)).toBeUndefined();
	});
});

describe("constrainedImageStyle", () => {
	it("uses a declared pair for the ratio and caps both axes", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/a.png", width: 200, height: 200 },
				{ fallbackRatio: "16 / 9" },
			),
		).toEqual({
			"aspect-ratio": "200 / 200",
			"max-width": "200px",
			"max-height": "200px",
		});
	});

	it("caps the width and keeps the fallback ratio when only a width is declared", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/b.png", width: 400 },
				{ fallbackRatio: "16 / 9" },
			),
		).toEqual({ "aspect-ratio": "16 / 9", "max-width": "400px" });
	});

	it("caps the height and frees the width when only a height is declared", () => {
		expect(
			constrainedImageStyle({ url: "https://example.test/c.png", height: 64 }),
		).toEqual({ "max-height": "64px", width: "auto" });
	});

	it("turns a lone declared height into a width cap once a ratio is known", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/d.png", height: 100 },
				{ fallbackRatio: "16 / 9" },
			),
		).toEqual({
			"aspect-ratio": "16 / 9",
			"max-width": "177px",
			"max-height": "100px",
		});
	});

	it("falls back to the given ratio when nothing is declared", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/e.png" },
				{ fallbackRatio: "16 / 9" },
			),
		).toEqual({ "aspect-ratio": "16 / 9" });
	});

	it("returns an empty style when nothing is known at all", () => {
		expect(constrainedImageStyle(undefined)).toEqual({});
	});

	it("holds an undeclared hero to the height cap by narrowing it", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/f.png" },
				{ fallbackRatio: "16 / 9", maxHeight: 200 },
			),
		).toEqual({
			"aspect-ratio": "16 / 9",
			"max-width": "355px",
			"max-height": "200px",
		});
	});

	it("holds a tall declared hero to the height cap", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/g.png", width: 1200, height: 1200 },
				{ fallbackRatio: "16 / 9", maxHeight: 200 },
			),
		).toEqual({
			"aspect-ratio": "1200 / 1200",
			"max-width": "200px",
			"max-height": "200px",
		});
	});

	it("never upscales a small image to the height cap", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/h.png", width: 120, height: 80 },
				{ fallbackRatio: "16 / 9", maxHeight: 200 },
			),
		).toEqual({
			"aspect-ratio": "120 / 80",
			"max-width": "120px",
			"max-height": "80px",
		});
	});

	it("fits a wide thumbnail inside the square box", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/i.png", width: 1200, height: 630 },
				{ maxWidth: 64, maxHeight: 64 },
			),
		).toEqual({
			"aspect-ratio": "1200 / 630",
			"max-width": "64px",
			"max-height": "64px",
		});
	});

	it("narrows a tall thumbnail so its height stays in the box", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/j.png", width: 630, height: 1200 },
				{ maxWidth: 64, maxHeight: 64 },
			),
		).toEqual({
			"aspect-ratio": "630 / 1200",
			"max-width": "33px",
			"max-height": "64px",
		});
	});

	it("leaves a thumbnail already inside the box alone", () => {
		expect(
			constrainedImageStyle(
				{ url: "https://example.test/k.png", width: 40, height: 40 },
				{ maxWidth: 64, maxHeight: 64 },
			),
		).toEqual({
			"aspect-ratio": "40 / 40",
			"max-width": "40px",
			"max-height": "40px",
		});
	});
});
