import {
	decompressFrame,
	type ParsedFrame,
	type ParsedGif,
	parseGIF,
} from "gifuct-js";
import UPNG from "upng-js";

export type RgbaFrame = {
	pixels: Uint8ClampedArray<ArrayBuffer>;
	delayMs: number;
};

export type RgbaAnimation = {
	width: number;
	height: number;
	frames: Iterable<RgbaFrame>;
};

type GifImage = Parameters<typeof decompressFrame>[0];

type GifDisposal = {
	dims: ParsedFrame["dims"];
	disposalType: number;
	snapshot?: Uint8ClampedArray<ArrayBuffer>;
};

const GIF_DISPOSE_BACKGROUND = 2;
const GIF_DISPOSE_PREVIOUS = 3;

const ownBuffer = (bytes: Uint8Array) => {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength,
	) as ArrayBuffer;
};

const isGifImage = (frame: ParsedGif["frames"][number]): frame is GifImage => {
	return "image" in frame;
};

const clearRect = (
	canvas: Uint8ClampedArray,
	width: number,
	height: number,
	dims: ParsedFrame["dims"],
) => {
	const right = Math.min(width, dims.left + dims.width);
	const bottom = Math.min(height, dims.top + dims.height);

	for (let y = Math.max(0, dims.top); y < bottom; y++) {
		const start = (y * width + Math.max(0, dims.left)) * 4;

		canvas.fill(0, start, (y * width + right) * 4);
	}
};

const drawPatch = (
	canvas: Uint8ClampedArray,
	width: number,
	height: number,
	frame: ParsedFrame,
) => {
	const { dims, patch } = frame;

	for (let y = 0; y < dims.height; y++) {
		const targetY = dims.top + y;

		if (targetY < 0 || targetY >= height) continue;

		for (let x = 0; x < dims.width; x++) {
			const targetX = dims.left + x;
			const source = (y * dims.width + x) * 4;

			if (targetX < 0 || targetX >= width || patch[source + 3] === 0) {
				continue;
			}

			canvas.set(
				patch.subarray(source, source + 4),
				(targetY * width + targetX) * 4,
			);
		}
	}
};

const disposeGifFrame = (
	canvas: Uint8ClampedArray<ArrayBuffer>,
	width: number,
	height: number,
	previous: GifDisposal,
) => {
	if (previous.disposalType === GIF_DISPOSE_BACKGROUND) {
		clearRect(canvas, width, height, previous.dims);
	} else if (
		previous.disposalType === GIF_DISPOSE_PREVIOUS &&
		previous.snapshot
	) {
		canvas.set(previous.snapshot);
	}
};

function* composeGif(
	gif: ParsedGif,
	images: readonly GifImage[],
	width: number,
	height: number,
): Generator<RgbaFrame> {
	const canvas = new Uint8ClampedArray(width * height * 4);
	let previous: GifDisposal | undefined;

	for (const image of images) {
		const frame = decompressFrame(image, gif.gct, true);

		if (previous) disposeGifFrame(canvas, width, height, previous);

		const snapshot =
			frame.disposalType === GIF_DISPOSE_PREVIOUS ? canvas.slice() : undefined;

		drawPatch(canvas, width, height, frame);

		yield { pixels: canvas.slice(), delayMs: frame.delay ?? 0 };

		previous = {
			dims: frame.dims,
			disposalType: frame.disposalType ?? 0,
			snapshot,
		};
	}
}

export const decodeGif = (
	bytes: Uint8Array,
	maxFrames: number,
): RgbaAnimation => {
	const gif = parseGIF(ownBuffer(bytes));
	const { width, height } = gif.lsd;
	const images = gif.frames.filter(isGifImage).slice(0, maxFrames);

	return { width, height, frames: composeGif(gif, images, width, height) };
};

export const decodeApng = (
	bytes: Uint8Array,
	maxFrames: number,
): RgbaAnimation => {
	const png = UPNG.decode(ownBuffer(bytes));

	png.frames = png.frames.slice(0, maxFrames);

	const delays = png.frames.map((frame) => frame.delay);
	const frames = UPNG.toRGBA8(png).map((buffer, index) => ({
		pixels: new Uint8ClampedArray(buffer),
		delayMs: delays[index] ?? 0,
	}));

	return { width: png.width, height: png.height, frames };
};

export const decodeWithScript = (
	bytes: Uint8Array,
	type: string,
	maxFrames: number,
) => {
	if (type === "image/gif") return decodeGif(bytes, maxFrames);
	if (type === "image/png") return decodeApng(bytes, maxFrames);

	return undefined;
};
