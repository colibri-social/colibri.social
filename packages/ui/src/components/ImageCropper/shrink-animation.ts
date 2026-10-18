/// <reference path="../../gifenc.d.ts" />
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import type { Size } from "./crop-math";

const MAX_FRAMES = 300;
const DEFAULT_DELAY_MS = 100;

export type AnimationFrame = { rgba: Uint8ClampedArray; delay: number };

export type DecodedAnimation = {
	width: number;
	height: number;
	source: Size;
	frames: AnimationFrame[];
};

export type AnimationQuality = { step: number; colors: number };

export const FULL_QUALITY: AnimationQuality = { step: 1, colors: 256 };

export const REDUCED_QUALITIES: readonly AnimationQuality[] = [
	{ step: 1, colors: 128 },
	{ step: 2, colors: 128 },
	{ step: 2, colors: 64 },
	{ step: 3, colors: 64 },
	{ step: 4, colors: 32 },
];

export const canDecodeAnimation = () => typeof ImageDecoder !== "undefined";

const openDecoder = async (file: File) => {
	const decoder = new ImageDecoder({
		data: await file.arrayBuffer(),
		type: file.type,
	});
	await decoder.tracks.ready;
	await decoder.completed;
	return decoder;
};

export const frameCountOf = async (file: File) => {
	if (!canDecodeAnimation()) return undefined;
	try {
		const decoder = await openDecoder(file);
		const count = decoder.tracks.selectedTrack?.frameCount;
		decoder.close();
		return count;
	} catch {
		return undefined;
	}
};

export const fitInside = (size: Size, box: Size): Size => {
	const scale = Math.min(1, box.width / size.width, box.height / size.height);
	return {
		width: Math.max(1, Math.round(size.width * scale)),
		height: Math.max(1, Math.round(size.height * scale)),
	};
};

export const decodeAnimation = async (
	file: File,
	box: Size,
): Promise<DecodedAnimation> => {
	const decoder = await openDecoder(file);
	try {
		const count = Math.min(
			decoder.tracks.selectedTrack?.frameCount ?? 0,
			MAX_FRAMES,
		);
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("Canvas is unavailable");
		const frames: AnimationFrame[] = [];
		let size: Size | undefined;
		let source: Size | undefined;
		for (let index = 0; index < count; index++) {
			const { image } = await decoder.decode({ frameIndex: index });
			if (!size) {
				source = { width: image.displayWidth, height: image.displayHeight };
				size = fitInside(source, box);
				canvas.width = size.width;
				canvas.height = size.height;
				context.imageSmoothingEnabled = true;
				context.imageSmoothingQuality = "high";
			}
			context.clearRect(0, 0, size.width, size.height);
			context.drawImage(image, 0, 0, size.width, size.height);
			frames.push({
				rgba: context.getImageData(0, 0, size.width, size.height).data,
				delay: image.duration ? image.duration / 1000 : DEFAULT_DELAY_MS,
			});
			image.close();
		}
		canvas.width = 0;
		canvas.height = 0;
		if (!size || !source || frames.length === 0)
			throw new Error("The GIF has no frames");
		return { ...size, source, frames };
	} finally {
		decoder.close();
	}
};

const thinFrames = (frames: readonly AnimationFrame[], step: number) => {
	const kept: AnimationFrame[] = [];
	for (let index = 0; index < frames.length; index += step) {
		const group = frames.slice(index, index + step);
		const first = group[0];
		if (!first) continue;
		kept.push({
			rgba: first.rgba,
			delay: group.reduce((total, frame) => total + frame.delay, 0),
		});
	}
	return kept;
};

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export const encodeAnimation = async (
	animation: DecodedAnimation,
	quality: AnimationQuality,
) => {
	const encoder = GIFEncoder();
	for (const frame of thinFrames(animation.frames, quality.step)) {
		await nextTask();
		const pixels = new Uint8Array(frame.rgba.buffer);
		const palette = quantize(pixels, quality.colors, {
			format: "rgba4444",
			oneBitAlpha: true,
		});
		const index = applyPalette(pixels, palette, "rgba4444");
		const transparentIndex = palette.findIndex((color) => color[3] === 0);
		encoder.writeFrame(index, animation.width, animation.height, {
			palette,
			delay: frame.delay,
			transparent: transparentIndex >= 0,
			transparentIndex: Math.max(transparentIndex, 0),
		});
	}
	encoder.finish();
	return encoder.bytes();
};

const gifName = (name: string) =>
	`${name.replace(/\.[^./\\]+$/, "") || "image"}.gif`;

const asFile = (bytes: Uint8Array<ArrayBuffer>, name: string) =>
	new File([bytes], gifName(name), { type: "image/gif" });

export type ShrinkResult =
	| { kind: "fits"; file: File }
	| { kind: "tooLarge"; reduce: () => Promise<File | undefined> };

export const shrinkAnimation = async (
	file: File,
	options: { box: Size; maxBytes: number },
): Promise<ShrinkResult> => {
	const animation = await decodeAnimation(file, options.box);
	const withinBox =
		animation.source.width <= options.box.width &&
		animation.source.height <= options.box.height;
	if (withinBox && file.size <= options.maxBytes) return { kind: "fits", file };
	const full = await encodeAnimation(animation, FULL_QUALITY);
	if (full.byteLength <= options.maxBytes)
		return { kind: "fits", file: asFile(full, file.name) };
	return {
		kind: "tooLarge",
		reduce: async () => {
			for (const quality of REDUCED_QUALITIES) {
				const bytes = await encodeAnimation(animation, quality);
				if (bytes.byteLength <= options.maxBytes)
					return asFile(bytes, file.name);
			}
			return undefined;
		},
	};
};
