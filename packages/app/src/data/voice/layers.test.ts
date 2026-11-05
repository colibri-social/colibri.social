import { describe, expect, it } from "vitest";
import {
	type LayerContext,
	layerHeight,
	preferredLayers,
	samePreference,
	spatialLayersOf,
	tileKeyFor,
} from "./layers";

const camera: LayerContext = {
	source: "cam",
	spatialLayers: 3,
	documentHidden: false,
	pixelRatio: 1,
};

const screen: LayerContext = { ...camera, source: "screen", spatialLayers: 2 };

describe("tileKeyFor", () => {
	it("matches the grid's camera and screen tile keys", () => {
		expect(tileKeyFor({ did: "did:plc:a", source: "cam" })).toBe("p:did:plc:a");
		expect(tileKeyFor({ did: "did:plc:a", source: "screen" })).toBe(
			"s:did:plc:a",
		);
	});
});

describe("spatialLayersOf", () => {
	it("reads simulcast and SVC scalability modes", () => {
		expect(spatialLayersOf("L3T3", "cam")).toBe(3);
		expect(spatialLayersOf("S2T3", "screen")).toBe(2);
		expect(spatialLayersOf("L1T3", "screen")).toBe(1);
	});

	it("falls back to the layers each source sends", () => {
		expect(spatialLayersOf(undefined, "cam")).toBe(3);
		expect(spatialLayersOf("bogus", "screen")).toBe(2);
	});
});

describe("layerHeight", () => {
	it("halves the height for each layer below the top", () => {
		expect([0, 1, 2].map((layer) => layerHeight(layer, 3, "cam"))).toEqual([
			180, 360, 720,
		]);
		expect([0, 1].map((layer) => layerHeight(layer, 2, "screen"))).toEqual([
			540, 1080,
		]);
	});
});

describe("preferredLayers", () => {
	it("pauses tiles that are off screen or in a hidden document", () => {
		expect(preferredLayers({ height: 400, visible: false }, camera)).toEqual({
			spatialLayer: 0,
			paused: true,
		});
		expect(
			preferredLayers(
				{ height: 400, visible: true },
				{ ...camera, documentHidden: true },
			),
		).toEqual({ spatialLayer: 0, paused: true });
		expect(preferredLayers({ height: 0, visible: true }, camera).paused).toBe(
			true,
		);
	});

	it("picks camera layers by rendered height", () => {
		const layer = (height: number) =>
			preferredLayers({ height, visible: true }, camera).spatialLayer;
		expect([180, 225, 226, 450, 451, 1000].map(layer)).toEqual([
			0, 0, 1, 1, 2, 2,
		]);
	});

	it("counts device pixels", () => {
		expect(
			preferredLayers(
				{ height: 200, visible: true },
				{ ...camera, pixelRatio: 2 },
			).spatialLayer,
		).toBe(1);
	});

	it("keeps screen text sharp once the tile outgrows the half layer", () => {
		const layer = (height: number) =>
			preferredLayers({ height, visible: true }, screen).spatialLayer;
		expect([300, 540, 541, 900].map(layer)).toEqual([0, 0, 1, 1]);
	});

	it("drops the frame rate for strip thumbnails", () => {
		expect(preferredLayers({ height: 88, visible: true }, screen)).toEqual({
			spatialLayer: 0,
			temporalLayer: 1,
			paused: false,
		});
		expect(preferredLayers({ height: 300, visible: true }, camera)).toEqual({
			spatialLayer: 1,
			paused: false,
		});
	});

	it("stays on the only layer of a single layer stream", () => {
		expect(
			preferredLayers(
				{ height: 1000, visible: true },
				{ ...camera, spatialLayers: 1 },
			).spatialLayer,
		).toBe(0);
	});
});

describe("samePreference", () => {
	it("compares every field", () => {
		const base = { spatialLayer: 1, paused: false };
		expect(samePreference(undefined, base)).toBe(false);
		expect(samePreference({ ...base }, base)).toBe(true);
		expect(samePreference({ ...base, temporalLayer: 1 }, base)).toBe(false);
		expect(samePreference({ ...base, paused: true }, base)).toBe(false);
	});
});
