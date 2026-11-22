import { describe, expect, it } from "vitest";
import { animationLoopMs, isAnimatedImageData } from "./animation-sniff";

const bytes = (...parts: (string | number[])[]) =>
	new Uint8Array(
		parts.flatMap((part) =>
			typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
		),
	);

const u32 = (value: number) => [
	(value >>> 24) & 0xff,
	(value >>> 16) & 0xff,
	(value >>> 8) & 0xff,
	value & 0xff,
];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const chunk = (type: string, data: number[] = []) => [
	...u32(data.length),
	...[...type].map((c) => c.charCodeAt(0)),
	...data,
	0,
	0,
	0,
	0,
];

const webp = (flags: number) =>
	bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0, flags, 0, 0, 0]);

const gifFrame = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x4c, 0x01, 0];
const gif = (frames: number) =>
	bytes(
		"GIF89a",
		[1, 0, 1, 0, 0x80, 0, 0],
		[0, 0, 0, 255, 255, 255],
		[0x21, 0xf9, 4, 0, 0, 0, 0, 0],
		...Array.from({ length: frames }, () => gifFrame),
		[0x3b],
	);

describe("isAnimatedImageData", () => {
	it("tells an APNG from a still PNG", () => {
		const ihdr = chunk("IHDR", Array(13).fill(0));
		expect(
			isAnimatedImageData(
				bytes(
					PNG_SIGNATURE,
					ihdr,
					chunk("acTL", Array(8).fill(0)),
					chunk("IDAT"),
				),
			),
		).toBe(true);
		expect(
			isAnimatedImageData(
				bytes(PNG_SIGNATURE, ihdr, chunk("IDAT"), chunk("IEND")),
			),
		).toBe(false);
	});

	it("reads the WebP animation flag", () => {
		expect(isAnimatedImageData(webp(0x02))).toBe(true);
		expect(isAnimatedImageData(webp(0x10))).toBe(false);
	});

	it("counts GIF frames", () => {
		expect(isAnimatedImageData(gif(2))).toBe(true);
		expect(isAnimatedImageData(gif(1))).toBe(false);
	});

	it("treats JPEG and short data as still", () => {
		expect(
			isAnimatedImageData(bytes([0xff, 0xd8, 0xff], Array(20).fill(0))),
		).toBe(false);
		expect(isAnimatedImageData(bytes("GIF"))).toBe(false);
	});
});

const timedGif = (...delays: number[]) =>
	bytes(
		"GIF89a",
		[1, 0, 1, 0, 0x80, 0, 0],
		[0, 0, 0, 255, 255, 255],
		...delays.flatMap((delay) => [
			[0x21, 0xf9, 4, 0, delay & 0xff, delay >> 8, 0, 0],
			gifFrame,
		]),
		[0x3b],
	);

const le24 = (value: number) => [
	value & 0xff,
	(value >> 8) & 0xff,
	(value >> 16) & 0xff,
];

const anmf = (duration: number) => [
	..."ANMF".split("").map((c) => c.charCodeAt(0)),
	16,
	0,
	0,
	0,
	...Array(12).fill(0),
	...le24(duration),
	0,
];

const fctl = (numerator: number, denominator: number) =>
	chunk("fcTL", [
		...Array(20).fill(0),
		numerator >> 8,
		numerator & 0xff,
		denominator >> 8,
		denominator & 0xff,
		0,
		0,
	]);

describe("animationLoopMs", () => {
	it("sums GIF frame delays", () => {
		expect(animationLoopMs(timedGif(5, 7))).toBe(120);
	});

	it("treats instant GIF frames as 100ms like browsers", () => {
		expect(animationLoopMs(timedGif(0, 1, 4))).toBe(240);
	});

	it("sums WebP frame durations", () => {
		expect(
			animationLoopMs(bytes("RIFF", [0, 0, 0, 0], "WEBP", anmf(80), anmf(120))),
		).toBe(200);
	});

	it("sums APNG frame delays", () => {
		const ihdr = chunk("IHDR", Array(13).fill(0));
		expect(
			animationLoopMs(
				bytes(
					PNG_SIGNATURE,
					ihdr,
					chunk("acTL", Array(8).fill(0)),
					fctl(1, 20),
					chunk("IDAT"),
					fctl(3, 0),
					chunk("IEND"),
				),
			),
		).toBe(80);
	});

	it("has no loop for still images", () => {
		expect(animationLoopMs(gif(1))).toBeUndefined();
		expect(animationLoopMs(webp(0x10))).toBeUndefined();
	});
});
