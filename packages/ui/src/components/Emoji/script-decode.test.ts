import { crc32, deflateSync } from "node:zlib";
import { GIFEncoder } from "gifenc";
import { describe, expect, it } from "vitest";
import {
	STRIP_FRAME_DELAYS,
	STRIP_PART_SIZE,
	stripPartGif,
} from "./animated-fixtures";
import { frameAt, frameDelayMs, frameTimeline } from "./frame-clock";
import { decodeApng, decodeGif } from "./script-decode";

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

const pixelAt = (
	pixels: Uint8ClampedArray,
	width: number,
	x: number,
	y: number,
) => {
	const offset = (y * width + x) * 4;

	return Array.from(pixels.subarray(offset, offset + 4));
};

const disposalGif = (firstDisposal: number) => {
	const encoder = GIFEncoder();
	const palette = [[0, 0, 0], RED, BLUE];
	const transparentWithDot = new Uint8Array(4);

	transparentWithDot[0] = 2;
	encoder.writeFrame(new Uint8Array(4).fill(1), 2, 2, {
		palette,
		delay: 100,
		transparent: true,
		transparentIndex: 0,
		dispose: firstDisposal,
	});
	encoder.writeFrame(transparentWithDot, 2, 2, {
		palette,
		delay: 100,
		transparent: true,
		transparentIndex: 0,
		dispose: 1,
	});
	encoder.finish();

	return encoder.bytes();
};

const pngChunk = (type: string, data: Uint8Array) => {
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const head = Buffer.alloc(4);
	const tail = Buffer.alloc(4);

	head.writeUInt32BE(data.length);
	tail.writeUInt32BE(crc32(body));

	return Buffer.concat([head, body, tail]);
};

const uint32s = (...values: number[]) => {
	const buffer = Buffer.alloc(values.length * 4);

	for (const [index, value] of values.entries()) {
		buffer.writeUInt32BE(value, index * 4);
	}

	return buffer;
};

const frameControl = (sequence: number, delayMs: number) => {
	const buffer = Buffer.alloc(26);

	buffer.writeUInt32BE(sequence, 0);
	buffer.writeUInt32BE(1, 4);
	buffer.writeUInt32BE(1, 8);
	buffer.writeUInt16BE(delayMs, 20);
	buffer.writeUInt16BE(1000, 22);

	return buffer;
};

const pixelData = (color: number[]) => {
	return deflateSync(Buffer.from([0, ...color, 255]));
};

const twoFrameApng = (delays: [number, number]) => {
	return new Uint8Array(
		Buffer.concat([
			Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
			pngChunk(
				"IHDR",
				Buffer.concat([uint32s(1, 1), Buffer.from([8, 6, 0, 0, 0])]),
			),
			pngChunk("acTL", uint32s(2, 0)),
			pngChunk("fcTL", frameControl(0, delays[0])),
			pngChunk("IDAT", pixelData(RED)),
			pngChunk("fcTL", frameControl(1, delays[1])),
			pngChunk("fdAT", Buffer.concat([uint32s(2), pixelData(BLUE)])),
			pngChunk("IEND", Buffer.alloc(0)),
		]),
	);
};

describe("script animation decoder", () => {
	it("decodes a GIF fixture into its frame delays", () => {
		const animation = decodeGif(stripPartGif(0), 300);
		const frames = Array.from(animation.frames);

		expect(animation.width).toBe(STRIP_PART_SIZE);
		expect(animation.height).toBe(STRIP_PART_SIZE);
		expect(frames.map((frame) => frame.delayMs)).toEqual(STRIP_FRAME_DELAYS);
		expect(frames[0].pixels.length).toBe(STRIP_PART_SIZE * STRIP_PART_SIZE * 4);
	});

	it("caps the number of decoded GIF frames", () => {
		const frames = Array.from(decodeGif(stripPartGif(1), 3).frames);

		expect(frames).toHaveLength(3);
	});

	it("keeps the previous GIF frame under transparent pixels", () => {
		const [, second] = Array.from(decodeGif(disposalGif(1), 300).frames);

		expect(pixelAt(second.pixels, 2, 0, 0)).toEqual([...BLUE, 255]);
		expect(pixelAt(second.pixels, 2, 1, 1)).toEqual([...RED, 255]);
	});

	it("clears a GIF frame that disposes to the background", () => {
		const [, second] = Array.from(decodeGif(disposalGif(2), 300).frames);

		expect(pixelAt(second.pixels, 2, 0, 0)).toEqual([...BLUE, 255]);
		expect(pixelAt(second.pixels, 2, 1, 1)).toEqual([0, 0, 0, 0]);
	});

	it("decodes APNG frames and their delays", () => {
		const animation = decodeApng(twoFrameApng([80, 160]), 300);
		const frames = Array.from(animation.frames);

		expect(frames.map((frame) => frame.delayMs)).toEqual([80, 160]);
		expect(pixelAt(frames[1].pixels, 1, 0, 0)).toEqual([...BLUE, 255]);
	});

	it("shows the same frame on canvases started at different times", () => {
		const delays = Array.from(decodeGif(stripPartGif(2), 300).frames).map(
			(frame) => frameDelayMs(frame.delayMs * 1000),
		);
		const timeline = frameTimeline(delays);
		const canvasStarts = [1_000, 1_437];
		let elapsedClocksDisagree = false;

		for (let now = 1_500; now < 1_500 + timeline.loopMs * 2; now += 7) {
			const [first, second] = canvasStarts.map(() => frameAt(timeline, now));
			const [firstElapsed, secondElapsed] = canvasStarts.map((start) =>
				frameAt(timeline, now - start),
			);

			expect(first).toBe(second);
			elapsedClocksDisagree ||= firstElapsed !== secondElapsed;
		}

		expect(elapsedClocksDisagree).toBe(true);
	});
});
