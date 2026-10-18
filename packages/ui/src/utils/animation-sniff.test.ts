import { describe, expect, it } from "vitest";
import { isAnimatedImageData } from "./animation-sniff";

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
